import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrataService } from "../lib/service.js";
import { createProfile } from "../lib/profiles.js";
import { projectionPath } from "../lib/bundled.js";
import { tuningFailure } from "../lib/tuning.js";

test("projection resolves from the installed Control runtime and a missing asset fails before launch", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-runtime-asset-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  service.settings = { controlDir: join(root, "installed runtime/control") };
  const vector = projectionPath(service.settings.controlDir);
  await mkdir(join(vector, ".."), { recursive: true });
  await writeFile(vector, "asset");
  const p = createProfile(
    {
      name: "Qwen3.8-Flash-Next-Gyro-L",
      architecture: "qwen4exp",
      files: [{ index: 1, metadata: { "qwen4exp.block_count": 48 } }],
    },
    8190,
  );
  p.config = { exe: "/engine", args: [], env: {} };
  const config = service.launchConfig(p);
  assert.equal(
    config.args[config.args.indexOf("--control-vector-scaled") + 1],
    vector + ":1.0",
  );
  await rm(vector);
  assert.throws(() => service.launchConfig(p), /projection file is missing/);
});
test("a nonzero native tuner exit reports its JSON reason and preserves the last good preset", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-tuning-error-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const reason = "Baseline could not start: missing model asset";
  const failure = Object.assign(new Error("python3 exited 6:"), {
    stdout: JSON.stringify({
      schema_version: 1,
      ok: true,
      result: { outcome: "base_failed", message: reason },
    }),
    exitCode: 6,
  });
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async () => {
      throw failure;
    },
  );
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(
    { name: "Fixture", architecture: "qwen4exp", files: [] },
    8190,
  );
  p.config = { exe: "/engine", args: [], env: {} };
  p.tuneReport = { preset: { id: "keep" } };
  service.profiles = [p];
  await assert.rejects(
    () => service.tune(p.id, new AbortController().signal, () => {}),
    { message: reason },
  );
  assert.equal(p.tuneReport.preset.id, "keep");
  const plain = new Error("Cancelled");
  assert.equal(tuningFailure(plain), plain);
  assert.equal(
    tuningFailure(
      Object.assign(new Error("exit"), {
        stdout: JSON.stringify({
          schema_version: 1,
          ok: false,
          error: { message: "Invalid configuration" },
        }),
      }),
    ).message,
    "Invalid configuration",
  );
});
