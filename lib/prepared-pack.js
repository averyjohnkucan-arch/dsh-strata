import { access, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createProfile, validateProfile } from "./profiles.js";
import { kvArgument } from "./choices.js";

export const preparedPackFormat = "qwen-flash-next-nvfp4-v1";
export const preparedPackParts = Object.freeze([
  "pack/experts.bin",
  "pack/dense.bin",
  "pack/index.txt",
  "pack/native_experts.txt",
  "pack/tokenizer/vocab.json",
  "pack/tokenizer/merges.txt",
  "pack/tokenizer/token_type.json",
  "pack/tokenizer/tokenizer.json",
  "pack/tokenizer/chat_template.jinja",
  "ple-fp8.gguf",
  "token-embd-bf16.gguf",
  "mtp/experts.bin",
  "mtp/dense.bin",
  "mtp/dense.txt",
  "mtp/draft_vocab.bin",
]);
const denseNames = ["qwen-nvfp4-gptq-dense.gguf", "qwen-nvfp4-mix-dense.gguf"];
const tuningFlags = new Set([
  "--kv-grow",
  "--kv-resident",
  "--prefill",
  "--pool-workers",
  "--host-core",
  "--spec",
  "--pool-affinity",
  "--spec-min-p",
  "--pcie-frac",
  "--vram-reserve-mib",
  "--resident-budget-gib",
]);

export function preparedPackTuning(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid tuning settings");
  for (const [flag, setting] of Object.entries(value)) {
    if (
      !tuningFlags.has(flag) ||
      !["boolean", "number", "string"].includes(typeof setting) ||
      String(setting).length > 64 ||
      /[\/\\\0]/.test(String(setting))
    )
      throw new Error("Unsupported tuning setting in portable config");
  }
  return { ...value };
}

/** The manifest identifies data files only. It cannot choose executables, commands or libraries. */
export function preparedPackLayout(files) {
  const dense = files.filter(
    (f) => f.role === "model" && denseNames.includes(f.relative),
  );
  if (dense.length !== 1)
    throw new Error("Choose exactly one supported NVFP4 dense model");
  const required = new Set([...preparedPackParts, dense[0].relative]);
  const seen = new Set();
  for (const file of files) {
    const expectedRole =
      file.relative === dense[0].relative
        ? "model"
        : file.relative?.startsWith("mtp/")
          ? "mtp-runtime"
          : "part";
    if (file.role === "projector" && file.relative === "vision/mmproj.gguf")
      continue;
    if (
      !required.has(file.relative) ||
      seen.has(file.relative) ||
      file.role !== expectedRole
    )
      throw new Error("Unexpected or duplicate prepared model component");
    seen.add(file.relative);
  }
  if (seen.size !== required.size)
    throw new Error("Prepared model config is missing components");
  if (files.filter((f) => f.role === "projector").length > 1)
    throw new Error("Choose one vision projector");
  return dense[0].relative;
}

export async function preparedPackConfig(profile, runtime) {
  const root = profile.preparedPackRoot;
  const dense = join(root, profile.model.files[0].name);
  for (const path of [...preparedPackParts, profile.model.files[0].name])
    await access(join(root, path));
  const config = {
    exe: runtime.executable,
    cwd: runtime.controlDir,
    arch: "qwen4exp",
    model_name: profile.id,
    host: "127.0.0.1",
    port: profile.port,
    gpu: profile.gpu,
    tokenizer: join(root, "pack/tokenizer"),
    open_browser: false,
    lib_dirs: [dirname(runtime.executable)],
    env: {},
    args: [
      "--pack",
      join(root, "pack"),
      "--native",
      dense,
      "--native-dense-gguf",
      dense,
      "--ple-gguf",
      join(root, "ple-fp8.gguf"),
      "--embd-gguf",
      join(root, "token-embd-bf16.gguf"),
      "--expert-profile",
      join(runtime.controlDir, "data/expert-profile.bin"),
      "--expert-cache",
      "auto",
      "--prefill",
      "auto",
      "--spec",
      "4",
      "--spec-min-p",
      "0.5",
      "--mtp",
      profile.mtp,
      "--max-context",
      String(profile.context),
      "--kv",
      kvArgument(profile.kv),
    ],
  };
  if (profile.projector)
    config.vision = {
      exe:
        runtime.visionExecutable ||
        join(dirname(runtime.executable), "strata-vision"),
      model: dense,
      mmproj: profile.projector,
      gpu: profile.vision === "gpu",
    };
  return config;
}

/** All files have already matched exact size and MD5 before reaching this function. */
export async function importPreparedPack(
  service,
  manifest,
  files,
  signal,
  inspect,
) {
  const dense = preparedPackLayout(files);
  await mkdir(join(service.root, "imports"), { recursive: true });
  const root = await mkdtemp(join(service.root, "imports", "nvfp4-"));
  try {
    for (const file of files) {
      const path = join(root, file.relative);
      await mkdir(dirname(path), { recursive: true });
      await symlink(file.path, path);
    }
    const inventory = await inspect([join(root, dense)]);
    if (
      inventory.models.length !== 1 ||
      inventory.models[0].architecture !== "qwen4exp"
    )
      throw new Error("The prepared model is not Qwen Flash Next");
    const model = inventory.models[0];
    const metadata = model.files[0]?.metadata || {};
    if (
      metadata["qwen4exp.embedding_length"] !== 2560 ||
      metadata["qwen4exp.expert_count"] !== 512
    )
      throw new Error("The prepared model has incompatible geometry");
    // The dense GGUF intentionally has no routed experts: the matched pack supplies them.
    model.status = "complete";
    model.setupIssue = null;
    model.files[0].name = dense;
    let port = 8190;
    while (service.profiles.some((p) => p.port === port)) port++;
    const p = createProfile(model, port);
    Object.assign(p, {
      name: manifest.name,
      preparedPackRoot: root,
      applyPreset: false,
      context: manifest.settings.context,
      kv: manifest.settings.kv,
      gpu: manifest.settings.gpu ?? 0,
      cpuSet: manifest.settings.cpuSet || "",
      mtp: join(root, "mtp"),
      vision: manifest.settings.vision || "cpu",
      projector: files.some((f) => f.role === "projector")
        ? join(root, "vision/mmproj.gguf")
        : "",
    });
    p.projectorChoice = p.projector ? "selected" : "none";
    p.portableTuning = preparedPackTuning(manifest.settings.tuning);
    const valid = validateProfile(p);
    signal?.throwIfAborted();
    const next = [...service.profiles, valid];
    await service.store.write("profiles", next);
    service.profiles = next;
    service.changed();
    return { ids: [valid.id], files: files.length };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
