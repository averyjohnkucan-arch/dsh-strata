import { mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exportManifest, locateFiles, validateManifest } from "./portable.js";
import { createProfile, validateProfile } from "./profiles.js";

const runtimeFiles = [
  "experts.bin",
  "dense.bin",
  "dense.txt",
  "draft_vocab.bin",
];
const tuningFlags = new Set([
  "--kv-grow",
  "--kv-resident",
  "--prefill",
  "--pool-workers",
  "--host-core",
  "--spec",
]);

export async function exportConfig(service, id, signal, report) {
  const p = service.profile(id);
  const entries = p.model.files.map((file) => ({
    role: "model",
    path: file.path,
  }));
  if (p.projector) entries.push({ role: "projector", path: p.projector });
  let mtp = p.mtp;
  if (mtp === "auto") {
    const status = await service.mtpStatus(id);
    if (status.kind === "automatic-ready") mtp = status.path;
  }
  if (mtp && mtp !== "auto") {
    if ((await stat(mtp)).isDirectory())
      entries.push(
        ...runtimeFiles.map((name) => ({
          role: "mtp-runtime",
          path: join(mtp, name),
        })),
      );
    else entries.push({ role: "mtp", path: mtp });
  }
  const tuning = Object.fromEntries(
    Object.entries(
      p.tuneReport?.settings?.args || p.portableTuning || {},
    ).filter(([flag]) => tuningFlags.has(flag)),
  );
  return exportManifest(
    "strata",
    p.name,
    {
      context: p.context,
      kv: p.kv,
      gpu: p.gpu,
      vision: p.vision,
      projectorChoice: p.projectorChoice,
      mtpAuto: p.mtp === "auto",
      tuning,
    },
    entries,
    { signal, report },
  );
}

/** Reinspect matched model headers and keep imported JSON away from runtime commands and credentials. */
export async function importConfig(
  service,
  value,
  root,
  signal,
  report,
  inspect,
) {
  const manifest = validateManifest(value, "strata");
  const files = await locateFiles(manifest, root, { signal, report });
  if (!files.some((file) => file.role === "model"))
    throw new Error("The config contains no model shards");
  await mkdir(join(service.root, "imports"), { recursive: true });
  const directory = await mkdtemp(join(service.root, "imports", "config-"));
  try {
    const paths = [];
    for (const file of files) {
      const path = join(directory, file.role, file.name);
      await mkdir(dirname(path), { recursive: true });
      await symlink(file.path, path);
      paths.push({ ...file, path });
    }
    const inventory = await inspect(
      paths.filter((file) => file.role === "model").map((file) => file.path),
    );
    if (
      inventory.models.length !== 1 ||
      inventory.models[0].status !== "complete"
    )
      throw new Error("Matched files must form one complete model");
    let port = 8190;
    while (service.profiles.some((p) => p.port === port)) port++;
    const p = createProfile(inventory.models[0], port);
    const s = manifest.settings;
    Object.assign(p, {
      name: manifest.name,
      context: s.context,
      kv: s.kv,
      gpu: s.gpu ?? 0,
      vision: s.vision || "cpu",
    });
    p.projector = paths.find((file) => file.role === "projector")?.path || "";
    p.projectorChoice = p.projector
      ? "selected"
      : s.projectorChoice === "none"
        ? "none"
        : "";
    const runtime = paths.filter((file) => file.role === "mtp-runtime");
    if (runtime.length) {
      if (
        runtime.length !== runtimeFiles.length ||
        runtimeFiles.some((name) => !runtime.some((file) => file.name === name))
      )
        throw new Error("The config is missing prepared MTP runtime pieces");
      p.mtp = dirname(runtime[0].path);
    } else
      p.mtp =
        paths.find((file) => file.role === "mtp")?.path ||
        (s.mtpAuto ? "auto" : "");
    if (s.tuning && typeof s.tuning === "object") {
      p.portableTuning = {};
      for (const [flag, v] of Object.entries(s.tuning)) {
        if (
          !tuningFlags.has(flag) ||
          !["boolean", "number", "string"].includes(typeof v) ||
          String(v).length > 64 ||
          /[\/\\\0]/.test(String(v))
        )
          throw new Error("Unsupported tuning setting in portable config");
        p.portableTuning[flag] = v;
      }
    }
    const validated = validateProfile(p);
    signal?.throwIfAborted();
    const next = [...service.profiles, validated];
    await service.store.write("profiles", next);
    service.profiles = next;
    service.changed();
    return { ids: [validated.id], files: files.length };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
