import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { StrataService } from "../lib/service.js";
import { createProfile } from "../lib/profiles.js";
import { projectionPath } from "../lib/bundled.js";
import {
  tuningFailure,
  tuningSample,
  readTuningSample,
} from "../lib/tuning.js";

const sample = (prefill, decode, session = "") =>
  `strata serve: ${session}prompt 4024 tokens = 0 reused + 4024 read in 2121 ms (${prefill} tok/s), 200 generated in 4602 ms (${decode} tok/s), drafts accepted 0 of 0\n`;

async function waitForSample(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, "The tuning sample was not published");
    await delay(20);
  }
}

test("tuning rates use the latest complete native request for both engine log formats", () => {
  assert.deepEqual(tuningSample(sample(1684.7, 87.3)), {
    prefillTokS: 1684.7,
    decodeTokS: 87.3,
  });
  assert.deepEqual(
    tuningSample(
      sample(1684.7, 87.3) +
        sample(1896.9, 42.7, "session 0: ") +
        "strata serve: prompt 34 tokens = 0 reused + 34 read",
    ),
    { prefillTokS: 1896.9, decodeTokS: 42.7 },
  );
  assert.equal(tuningSample("loading model… 300 tok/s"), null);
  assert.deepEqual(tuningSample(sample(0, 40).replace("4024 read", "0 read")), {
    prefillTokS: null,
    decodeTokS: 40,
  });
});

test("a new tuning trial clears old rates and excludes logs from earlier runs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-tuning-samples-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "engine-99.log"), sample(9999, 999));
  await utimes(join(root, "engine-99.log"), 1, 1);
  const start = Date.now() - 1000;
  await writeFile(
    join(root, "engine-1.log"),
    "x".repeat(70000) + "\n" + sample(1800, 44),
  );
  await writeFile(join(root, "worker-99.log"), sample(9999, 999));
  assert.deepEqual(await readTuningSample(root, start), {
    prefillTokS: 1800,
    decodeTokS: 44,
  });
  await writeFile(join(root, "engine-2.log"), "Loading the next trial\n");
  assert.deepEqual(await readTuningSample(root, start), {
    prefillTokS: null,
    decodeTokS: null,
  });
  await writeFile(join(root, "engine-2.log"), sample(1900, 45));
  assert.deepEqual(await readTuningSample(root, start), {
    prefillTokS: 1900,
    decodeTokS: 45,
  });
});

test("tuning publishes new rates even while the native stage message stays the same", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-live-tuning-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const updates = [];
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async (_command, args) => {
      const directory = args[args.indexOf("--work-dir") + 1];
      const status = args[args.indexOf("--status-file") + 1];
      await writeFile(status, JSON.stringify({ message: "Measuring" }));
      await writeFile(join(directory, "engine-1.log"), sample(1700, 41));
      await waitForSample(() =>
        updates.some(([, metrics]) => metrics?.decodeTokS === 41),
      );
      await writeFile(join(directory, "engine-1.log"), sample(1800, 44));
      await waitForSample(() =>
        updates.some(
          ([message, metrics]) =>
            message === "Measuring" && metrics?.decodeTokS === 44,
        ),
      );
      return {
        stdout: JSON.stringify({
          schema_version: 1,
          ok: true,
          result: { outcome: "default_confirmed", preset: { id: "native" } },
        }),
      };
    },
  );
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(
    { name: "Fixture", architecture: "qwen4exp", files: [] },
    8190,
  );
  p.config = { exe: "/engine", args: [], env: {} };
  service.profiles = [p];
  await service.tune(p.id, new AbortController().signal, (...update) =>
    updates.push(update),
  );
});

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
