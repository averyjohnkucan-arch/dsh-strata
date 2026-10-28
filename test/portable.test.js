import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rename,
  rm,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  exportManifest,
  locateFiles,
  validateManifest,
  fileMd5,
} from "../lib/portable.js";
import { exportConfig, importConfig } from "../lib/config-transfer.js";
import { StrataService } from "../lib/service.js";
import { createProfile } from "../lib/profiles.js";

test("portable configs find renamed pieces recursively by size then MD5", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "portable-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = join(root, "original.bin");
  await writeFile(original, "model bytes");
  const config = await exportManifest("test", "A model", { context: 65536 }, [
    { role: "model", path: original },
  ]);
  assert.equal(config.files[0].md5.length, 32);
  const nested = join(root, "models", "nested");
  await mkdir(nested, { recursive: true });
  const moved = join(nested, "renamed.bin");
  await rename(original, moved);
  await writeFile(join(nested, "decoy.bin"), "wrong bytes");
  await writeFile(join(nested, "different-size.bin"), "ignore");
  await symlink(join(root, "models"), join(nested, "loop"));
  const progress = [];
  const found = await locateFiles(config, join(root, "models"), {
    report: (text) => progress.push(text),
  });
  assert.equal(found[0].path, moved);
  assert.ok(!progress.some((text) => text.includes("different-size.bin")));
  const wrong = structuredClone(config);
  wrong.files[0].md5 = "0".repeat(32);
  await assert.rejects(
    () => locateFiles(wrong, join(root, "models")),
    /No exact size and MD5 match/,
  );
  await assert.rejects(() => locateFiles(config, "/"), /model folder/);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () => fileMd5(moved, { signal: aborted.signal }),
    /abort/i,
  );
});

test("configs reject another engine and unsafe shard paths", () => {
  const config = {
    format: "dsh-local-model",
    version: 1,
    engine: "strata",
    name: "Test",
    settings: {},
    files: [
      {
        id: "0",
        role: "model",
        name: "model.gguf",
        size: 1,
        md5: "a".repeat(32),
      },
    ],
  };
  assert.throws(() => validateManifest(config, "ninfer"), /portable ninfer/);
  config.files[0].relative = "../outside";
  assert.throws(() => validateManifest(config, "strata"), /Unsafe relative/);
  delete config.files[0].relative;
  config.files[0].name = "..";
  assert.throws(
    () => validateManifest(config, "strata"),
    /Invalid file identity/,
  );
});

test("Strata config round trip restores model settings and portable tuning", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-portable-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  await mkdir(source);
  const main = join(source, "model.gguf");
  await writeFile(main, "model bytes");
  const service = new StrataService({ dataDir: join(root, "data") });
  await service.init();
  t.after(() => service.dispose());
  const model = {
    name: "Fixture",
    status: "complete",
    architecture: "qwen4exp",
    files: [{ index: 1, path: main, metadata: {} }],
  };
  const p = createProfile(model, 8190);
  p.context = 65536;
  p.kv = "Q8/Q8";
  p.tuneReport = { settings: { args: { "--kv-grow": true } } };
  service.profiles = [p];
  const manifest = await exportConfig(service, p.id);
  const moved = join(root, "relocated");
  await mkdir(moved);
  await rename(main, join(moved, "other.gguf"));
  const result = await importConfig(
    service,
    manifest,
    moved,
    undefined,
    undefined,
    async (paths) => ({
      models: [{ ...model, files: [{ ...model.files[0], path: paths[0] }] }],
    }),
  );
  const restored = service.profile(result.ids[0]);
  assert.equal(restored.context, 65536);
  assert.equal(restored.kv, "Q8/Q8");
  assert.equal(restored.port, 8191);
  assert.deepEqual(restored.portableTuning, { "--kv-grow": true });
});
