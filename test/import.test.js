import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrataService } from "../lib/service.js";
import {
  kvArgument,
  kvChoices,
  kvLabel,
  contextChoices,
  supportedKv,
} from "../lib/choices.js";
import { findProjector } from "../lib/companions.js";
import { createProfile, runConfig } from "../lib/profiles.js";

const model = {
  id: "model",
  name: "Model",
  architecture: "qwen4exp",
  status: "complete",
  files: [
    {
      path: "/models/a/model.gguf",
      index: 1,
      metadata: { "qwen4exp.context_length": 262144 },
    },
  ],
};
function projector(path) {
  return { role: "Vision", status: "complete", files: [{ path }] };
}
test("the seven K/V pairs retain their meaning in engine arguments", () => {
  assert.deepEqual(kvChoices, [
    "FP16/FP16",
    "FP16/Q8",
    "Q8/Q8",
    "Q8/Q5",
    "Q5/Q5",
    "Q5/Q4",
    "Q4/Q4",
  ]);
  for (const kv of kvChoices) {
    const profile = createProfile(model, 8190);
    profile.kv = kv;
    profile.config = { args: ["--native", "/model"], env: {} };
    const args = runConfig(profile).args;
    assert.equal(kvLabel(args[args.indexOf("--kv") + 1]), kv);
  }
  assert.equal(kvArgument("Q8/Q5"), "Q8/Q5");
  assert.deepEqual(supportedKv("--kv fp16|int8|q4_0"), [
    "FP16/FP16",
    "Q8/Q8",
    "Q4/Q4",
  ]);
  assert.deepEqual(supportedKv("--kv " + kvChoices.join("|")), kvChoices);
  assert.deepEqual(supportedKv("--kv fp32|fp16|int8|k8v4"), [
    "FP16/FP16",
    "Q8/Q8",
  ]);
  assert.deepEqual(supportedKv("unrecognized engine help"), []);
});
test("context choices use 32,768-token steps within the model's declared context", () => {
  const profile = createProfile(model, 8190);
  assert.deepEqual(
    contextChoices(profile),
    [32768, 65536, 98304, 131072, 163840, 196608, 229376, 262144],
  );
});
test("only a single local projector is auto-attached; missing or ambiguous projectors prompt selection", () => {
  assert.equal(findProjector(model, { components: [] }), "");
  assert.equal(
    findProjector(model, { components: [projector("/models/b/mmproj.gguf")] }),
    "",
  );
  assert.equal(
    findProjector(model, { components: [projector("/models/a/mmproj.gguf")] }),
    "/models/a/mmproj.gguf",
  );
  assert.equal(
    findProjector(model, {
      components: [
        projector("/models/a/mmproj.gguf"),
        projector("/models/a/mmproj-f16.gguf"),
      ],
    }),
    "",
  );
});
test("the host file picker lists GGUFs, opens subfolders, and surfaces invalid paths", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-picker-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "mmproj.GGUF"), "test");
  await writeFile(join(root, "ignore.txt"), "test");
  const listing = await service.action("browse", { path: root });
  assert.deepEqual(listing.files, ["mmproj.GGUF"]);
  assert.ok(listing.directories.includes("nested"));
  assert.equal((await service.browse(join(root, "nested"))).parent, root);
  await assert.rejects(() => service.browse(join(root, "missing")), /ENOENT/);
});
test("importing selected files adds the complete model and detected projector in one operation", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let args;
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async (_command, value) => {
      args = value;
      return {
        stdout: JSON.stringify({
          root: "/models/a",
          filesScanned: 3,
          models: [model, { ...model, id: "partial", status: "missing" }],
          components: [projector("/models/a/mmproj.gguf")],
        }),
      };
    },
  );
  await service.init();
  t.after(() => service.dispose());
  const job = await service.action("import", {
    path: "/models/a",
    files: ["/models/a/model.gguf"],
  });
  await service.jobs.items.get(job.id).promise;
  assert.ok(args.includes("--files"));
  assert.equal(service.profiles.length, 1);
  assert.equal(service.profiles[0].projector, "/models/a/mmproj.gguf");
  assert.equal(service.profiles[0].context, 32768);
  assert.deepEqual(service.profiles[0].extraArgs, []);
  assert.deepEqual(service.profiles[0].environment, {});
  assert.deepEqual(service.jobs.list()[0].result.ids, [service.profiles[0].id]);
});

test("clearing legacy overrides also clears the prepared engine environment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-legacy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const profile = createProfile(model, 8190);
  profile.environment = { STRATA_POOL_CORES: "1,2" };
  profile.config = {
    args: [],
    env: { STRATA_POOL_CORES: "1,2", NATIVE_SETTING: "keep" },
  };
  profile.tuneReport = { preset: { id: "old" } };
  service.profiles = [profile];
  const saved = await service.save({
    ...profile,
    environment: {},
    context: 65536,
  });
  assert.deepEqual(saved.config.env, { NATIVE_SETTING: "keep" });
  assert.equal(saved.tuneReport, undefined);
});
