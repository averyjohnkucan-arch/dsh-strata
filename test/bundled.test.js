import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bundledRuntime } from "../lib/bundled.js";

test("an offline package resolves its Python, engine, helper and fork from inside itself", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-bundle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtime = join(root, "runtime");
  for (const name of [
    "control/python/bin/python3",
    "control/strata.py",
    "engine/strata",
  ]) {
    const path = join(runtime, name);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, "");
  }
  await writeFile(
    join(runtime, "manifest.json"),
    JSON.stringify({
      pluginVersion: "0.5.0",
      platform: process.platform,
      arch: process.arch,
      strataRelease: "v0.2.7",
      fork: { cudaArchitectures: ["120"] },
    }),
  );
  const settings = await bundledRuntime(runtime, root);
  assert.equal(settings.python, join(runtime, "control/python/bin/python3"));
  assert.equal(settings.executable, join(runtime, "engine/strata"));
  assert.equal(settings.helper, join(root, "vendor/gguf-py"));
  assert.equal(settings.fork.executable, join(runtime, "gyro-l/strata"));
  assert.equal(await bundledRuntime(join(root, "absent"), root), null);
  await writeFile(
    join(runtime, "manifest.json"),
    JSON.stringify({
      pluginVersion: "0.5.0",
      platform: "wrong",
      arch: process.arch,
    }),
  );
  await assert.rejects(() => bundledRuntime(runtime, root), /platform/);
});
