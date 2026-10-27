import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  utimes,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Checkpoints } from "../lib/checkpoints.js";
import { StrataService } from "../lib/service.js";

async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), "strata-checkpoints-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function snapshot(cache, model, session, bytes, time) {
  const name = cache.filename(session, "settings");
  const path = join(await cache.directory(model), name);
  await writeFile(path, Buffer.alloc(bytes));
  await utimes(path, time, time);
  return name;
}

test("oldest last-used checkpoint is evicted first, including after a restart", async (t) => {
  const root = await temporary(t),
    cache = new Checkpoints(root, 20);
  const a = await snapshot(cache, "model", "A", 10, 1000),
    b = await snapshot(cache, "model", "B", 10, 2000),
    c = await snapshot(cache, "model", "C", 10, 3000);
  await cache.touch("model", a);
  const reopened = new Checkpoints(root, 20);
  const result = await reopened.prune("model");
  assert.equal(result.bytes, 20);
  assert.equal(result.evicted, 1);
  assert.ok(await reopened.existing("model", a));
  assert.equal(await reopened.existing("model", b), null);
  assert.ok(await reopened.existing("model", c));
});
test("budgets are per model and oversized snapshots do not evict usable older files", async (t) => {
  const root = await temporary(t),
    cache = new Checkpoints(root, 20);
  const a = await snapshot(cache, "model-a", "chat", 10, 1000),
    b = await snapshot(cache, "model-b", "chat", 10, 1000);
  const oversized = await snapshot(cache, "model-a", "large", 25, 2000);
  await cache.prune("model-a");
  assert.ok(await cache.existing("model-a", a));
  assert.ok(await cache.existing("model-b", b));
  assert.equal(await cache.existing("model-a", oversized), null);
  assert.ok(!cache.filename("../../chat", "settings").includes(".."));
});
test("checkpoint filenames cannot escape the cache or follow a symlink", async (t) => {
  const root = await temporary(t),
    cache = new Checkpoints(join(root, "cache"), 20),
    original = join(root, "weights");
  await writeFile(original, "keep");
  await assert.rejects(() => cache.directory("../weights"), /Invalid/);
  await assert.rejects(() => cache.existing("model", "../weights"), /Invalid/);
  const name = cache.filename("chat", "settings");
  await symlink(original, join(await cache.directory("model"), name));
  assert.equal(await cache.existing("model", name), null);
  await cache.prune("model");
  assert.equal(await readFile(original, "utf8"), "keep");
});
test("Strata owns save/restore; only the first normal conversation after loading restores from disk", async (t) => {
  const root = await temporary(t),
    service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const state = {
      profile: { id: "model", name: "Test" },
      checkpointSignature: "settings",
    },
    calls = [];
  service.checkpointRequest = async (_state, action, name) => {
    calls.push(action);
    if (action === "save")
      await writeFile(
        join(await service.checkpoints.directory("model"), name),
        "native-state",
      );
    return { n_restored: 42 };
  };
  const options = { sessionId: "chat" };
  await service.saveCheckpoint(state, options);
  await service.restoreCheckpoint(state, options);
  await service.restoreCheckpoint(state, options);
  await service.saveCheckpoint(state, {
    sessionId: "chat",
    purpose: "session-title",
  });
  assert.deepEqual(calls, ["save", "restore"]);
  assert.equal(state.restoredTokens, 42);
});
test("purge waits for an active answer and removes only plugin caches", async (t) => {
  const root = await temporary(t),
    service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  await writeFile(join(root, "weights"), "keep");
  await snapshot(service.checkpoints, "model", "chat", 10, 1000);
  service.answering = 1;
  const job = await service.action("purge-cache");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(service.jobs.list()[0].status, "running");
  service.answering = 0;
  await service.jobs.items.get(job.id).promise;
  assert.equal(service.jobs.list()[0].status, "complete");
  assert.equal(await readFile(join(root, "weights"), "utf8"), "keep");
  assert.equal(
    await service.checkpoints.existing(
      "model",
      service.checkpoints.filename("chat", "settings"),
    ),
    null,
  );
});
