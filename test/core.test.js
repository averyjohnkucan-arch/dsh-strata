import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Jobs } from "../lib/jobs.js";
import { Store } from "../lib/store.js";
import { createProfile, validateProfile, runConfig } from "../lib/profiles.js";
import { StrataService } from "../lib/service.js";

const model = {
  id: "inventory-id",
  name: "Test model",
  architecture: "qwen4exp",
  status: "complete",
  files: [{ path: "/model.gguf", index: 1, metadata: {} }],
};
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), "dsh-strata-test-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test("queued operations are ordered and a failed operation does not block the next", async () => {
  const jobs = new Jobs(),
    events = [];
  jobs.add("first", async () => {
    events.push(1);
    throw new Error("fixture failure");
  });
  jobs.add("second", async () => events.push(2));
  await jobs.tail;
  assert.deepEqual(events, [1, 2]);
  assert.deepEqual(
    jobs.list().map((j) => j.status),
    ["failed", "complete"],
  );
  assert.equal(jobs.list()[0].controller, undefined);
});
test("cancelling queued work prevents its operation from running", async () => {
  const jobs = new Jobs();
  let release,
    ran = false;
  jobs.add(
    "first",
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const second = jobs.add("second", async () => {
    ran = true;
  });
  await Promise.resolve();
  jobs.cancel(second.id);
  release();
  await jobs.tail;
  assert.equal(ran, false);
  assert.equal(jobs.list()[1].status, "cancelled");
});
test("synchronous failures become failed jobs and disable cancels pending work", async () => {
  const jobs = new Jobs();
  jobs.add("bad", () => {
    throw new Error("bad");
  });
  await jobs.tail;
  assert.equal(jobs.list()[0].status, "failed");
  await jobs.close();
  assert.throws(() => jobs.add("closed", () => {}), /disabled/);
});
test("registry writes are ordered atomic snapshots and survive reopening", async (t) => {
  const root = await directory(t),
    store = new Store(root);
  await Promise.all([
    store.write("profiles", [{ id: 1 }]),
    store.write("profiles", [{ id: 2 }]),
  ]);
  assert.deepEqual(await new Store(root).read("profiles", []), [{ id: 2 }]);
  assert.deepEqual(await store.read("missing", []), []);
});
test("profiles use the native Thorough policy without plugin tuning overrides", () => {
  const p = createProfile(model, 8190);
  assert.equal(p.tune.mode, "thorough");
  assert.equal(
    validateProfile({ ...p, tune: { ...p.tune, mode: "quick" } }).tune.mode,
    "thorough",
  );
  assert.throws(
    () => validateProfile({ ...p, extraArgs: ["--native=/other"] }),
    /dedicated/,
  );
  assert.throws(
    () => validateProfile({ ...p, dflash: "/draft.gguf" }),
    /DFlash/,
  );
  assert.throws(
    () => validateProfile({ ...p, environment: { TEST: 4 } }),
    /strings/,
  );
  assert.throws(() => validateProfile({ ...p, kv: "invented" }), /unsupported/);
});
test("run configs apply saved controls once and keep original model paths", () => {
  const p = createProfile(model, 8190);
  p.context = 8192;
  p.kv = "q4_0";
  p.extraArgs = ["--prefill", "512"];
  p.config = {
    exe: "/engine",
    args: ["--native", "/model.gguf", "--max-context", "4096", "--kv", "fp16"],
    env: {},
  };
  const config = runConfig(p);
  assert.equal(config.args.filter((a) => a === "--max-context").length, 1);
  assert.equal(config.args[config.args.indexOf("--max-context") + 1], "8192");
  assert.ok(config.args.includes("/model.gguf"));
  assert.deepEqual(p.config.args.slice(-2), ["--kv", "fp16"]);
});
test("inventory adds multiple complete models on distinct ports and persists them", async (t) => {
  const root = await directory(t),
    service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  service.inventory = {
    models: [
      model,
      { ...model, id: "second", name: "Second" },
      { ...model, id: "partial", status: "missing" },
    ],
  };
  await service.action("add", { ids: [model.id, "second"] });
  assert.deepEqual(
    service.profiles.map((p) => p.port),
    [8190, 8191],
  );
  await service.action("add", { ids: [model.id] });
  assert.equal(service.profiles.length, 2);
  await assert.rejects(
    () => service.action("add", { ids: ["partial"] }),
    /complete/,
  );
  assert.equal(
    JSON.parse(await readFile(join(root, "profiles.json"))).length,
    2,
  );
  await service.action("remove", { id: service.profiles[0].id });
  assert.equal(service.profiles.length, 1);
});
test("failed tuning retains the previous saved report", async (t) => {
  const root = await directory(t);
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async () => ({
      stdout: JSON.stringify({
        schema_version: 1,
        ok: true,
        result: { outcome: "improved", preset: null },
      }),
    }),
  );
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(model, 8190);
  p.config = { exe: "/engine", args: ["--native", "/model"], env: {} };
  p.tuneReport = { preset: { id: "previous" } };
  service.profiles = [p];
  await assert.rejects(
    () => service.tune(p.id, new AbortController().signal, () => {}),
    /usable/,
  );
  assert.equal(p.tuneReport.preset.id, "previous");
});
test("native tuning success saves a real preset and uses actual Thorough arguments", async (t) => {
  const root = await directory(t);
  let captured;
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async (_command, args) => {
      captured = args;
      return {
        stdout: JSON.stringify({
          schema_version: 1,
          ok: true,
          result: { outcome: "default_confirmed", preset: { id: "measured" } },
        }),
      };
    },
  );
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(model, 8190);
  p.config = { exe: "/engine", args: ["--native", "/model"], env: {} };
  service.profiles = [p];
  await service.tune(p.id, new AbortController().signal, () => {});
  assert.equal(captured[captured.indexOf("--mode") + 1], "thorough");
  assert.equal(p.tuneReport.preset.id, "measured");
  for (const option of [
    "--goal",
    "--use",
    "--leave-ram",
    "--allow-small-differences",
    "--allow-not-repeatable",
  ])
    assert.ok(!captured.includes(option), option);
  const baseline = JSON.parse(
    await readFile(join(root, "tuning", p.id, "baseline.json")),
  );
  assert.ok(!baseline.args.includes("--pool-workers"));
  assert.ok(!baseline.args.includes("--prefill"));
});

test("GPU requests wait for the active answer before switching models", async (t) => {
  const root = await directory(t),
    service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const state = { active: 0, ready: true };
  let loadedOther = false;
  service.startServer = async (id) => {
    if (id === "other") {
      assert.equal(state.active, 0);
      loadedOther = true;
    }
    return state;
  };
  const first = await service.acquire("one");
  const second = service.acquire("other");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(loadedOther, false);
  assert.equal(state.active, 1);
  first.release();
  first.release();
  const next = await second;
  assert.equal(loadedOther, true);
  assert.equal(state.active, 1);
  next.release();
  assert.equal(service.answering, 0);
});

test("a mixed complete/incomplete selection adds nothing", async (t) => {
  const root = await directory(t),
    service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  service.inventory = {
    models: [model, { ...model, id: "partial", status: "missing" }],
  };
  await assert.rejects(
    () => service.action("add", { ids: [model.id, "partial"] }),
    /complete/,
  );
  assert.equal(service.profiles.length, 0);
});
