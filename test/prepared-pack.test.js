import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  stat,
  utimes,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { exportManifest } from "../lib/portable.js";
import { importConfig, exportConfig } from "../lib/config-transfer.js";
import { supportsFlashMtp } from "../lib/choices.js";
import {
  preparedPackFormat,
  preparedPackParts,
  preparedPackConfig,
  preparedPackLayout,
  preparedPackTuning,
} from "../lib/prepared-pack.js";

test("prepared NVFP4 import resolves all components and reconstructs a managed launch", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-packed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dense = "qwen-nvfp4-gptq-dense.gguf";
  const entries = [];
  for (const relative of [dense, ...preparedPackParts]) {
    const path = join(root, "source", relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, relative);
    entries.push({
      path,
      relative,
      role:
        relative === dense
          ? "model"
          : relative.startsWith("mtp/")
            ? "mtp-runtime"
            : "part",
    });
  }
  const manifest = await exportManifest(
    "strata",
    "NVFP4 GPTQ",
    {
      preparedPack: preparedPackFormat,
      context: 262144,
      kv: "FP16/FP16",
      cpuSet: "0-21",
      tuning: { "--kv-resident": 65536 },
    },
    entries,
  );
  const service = {
    root: join(root, "state"),
    profiles: [],
    changed() {},
    store: { async write() {} },
    profile(id) {
      return this.profiles.find((p) => p.id === id);
    },
  };
  const inspect = async ([path]) => ({
    models: [
      {
        name: "Dense",
        architecture: "qwen4exp",
        status: "complete",
        files: [
          {
            path,
            index: 1,
            name: dense,
            metadata: {
              "qwen4exp.embedding_length": 2560,
              "qwen4exp.expert_count": 512,
            },
          },
        ],
      },
    ],
  });
  const imported = await importConfig(
    service,
    manifest,
    join(root, "source"),
    undefined,
    undefined,
    inspect,
  );
  const p = service.profile(imported.ids[0]);
  assert.equal(p.context, 262144);
  assert.equal(p.kv, "FP16/FP16");
  assert.equal(p.cpuSet, "0-21");
  assert.equal(p.applyPreset, false);
  assert.equal(p.mtp, join(p.preparedPackRoot, "mtp"));
  assert.equal(supportsFlashMtp(p.model), false);
  assert.equal(supportsFlashMtp(p.model, Boolean(p.preparedPackRoot)), true);
  const wrongGeometry = structuredClone(p.model);
  wrongGeometry.files[0].metadata["qwen4exp.embedding_length"] = 4096;
  assert.equal(supportsFlashMtp(wrongGeometry, true), false);
  assert.deepEqual(p.portableTuning, { "--kv-resident": 65536 });
  const config = await preparedPackConfig(p, {
    executable: "/managed/strata",
    controlDir: "/managed/control",
  });
  assert.equal(config.exe, "/managed/strata");
  assert.ok(config.args.includes(join(p.preparedPackRoot, "ple-fp8.gguf")));
  assert.ok(
    config.args.includes(join(p.preparedPackRoot, "token-embd-bf16.gguf")),
  );
  assert.equal(config.args[config.args.indexOf("--kv") + 1], "fp16");
  assert.equal(
    await readFile(join(p.preparedPackRoot, "pack/experts.bin"), "utf8"),
    "pack/experts.bin",
  );
  const exported = await exportConfig(service, p.id);
  assert.deepEqual(exported.files, manifest.files);

  const q8 = structuredClone(manifest);
  q8.settings.kv = "Q8/Q8";
  const reports = [];
  const second = await importConfig(
    service,
    q8,
    join(root, "source"),
    undefined,
    (message) => reports.push(message),
    inspect,
  );
  assert.equal(service.profile(second.ids[0]).kv, "Q8/Q8");
  assert.equal(
    reports.filter((message) => message.startsWith("Checking ")).length,
    0,
  );

  // A same-sized replacement must fail identity matching even if its mtime is restored.
  const changed = join(root, "source", "pack/tokenizer/merges.txt");
  const before = await stat(changed);
  await writeFile(changed, Buffer.alloc(before.size, 66));
  await utimes(changed, before.atime, before.mtime);
  await assert.rejects(
    () =>
      importConfig(
        service,
        manifest,
        join(root, "source"),
        undefined,
        undefined,
        inspect,
      ),
    /No exact size and MD5 match/,
  );
});

test("prepared manifests cannot supply launch commands or incomplete and ambiguous layouts", () => {
  const files = ["qwen-nvfp4-gptq-dense.gguf", ...preparedPackParts].map(
    (relative) => ({
      relative,
      role: relative.endsWith("dense.gguf")
        ? "model"
        : relative.startsWith("mtp/")
          ? "mtp-runtime"
          : "part",
    }),
  );
  assert.equal(preparedPackLayout(files), "qwen-nvfp4-gptq-dense.gguf");
  assert.throws(() => preparedPackLayout(files.slice(1)), /exactly one/);
  assert.throws(() => preparedPackLayout(files.slice(0, -1)), /missing/);
  assert.throws(() => preparedPackLayout([...files, files[1]]), /duplicate/);
  assert.throws(
    () =>
      preparedPackLayout([...files, { relative: "../../evil", role: "part" }]),
    /Unexpected/,
  );
  assert.throws(
    () => preparedPackTuning({ "--pack": "/elsewhere" }),
    /Unsupported/,
  );
  assert.throws(
    () => preparedPackTuning({ "--prefill": "foo/bar" }),
    /Unsupported/,
  );
});
