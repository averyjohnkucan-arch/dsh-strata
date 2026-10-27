import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repairInventory } from "../lib/inventory.js";
import { createProfile } from "../lib/profiles.js";
import { StrataService } from "../lib/service.js";

test("legacy control-vector profiles move into Components without changing files or losing their saved record", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-components-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "projection.gguf");
  await writeFile(path, "original vector");
  const vector = {
    id: "vector",
    name: "Refusal projection",
    architecture: "controlvector",
    role: "Model",
    status: "complete",
    files: [{ path, index: 1 }],
    missing: [],
    duplicates: [],
    expected: 1,
    bytes: 15,
  };
  const model = {
    ...vector,
    id: "model",
    name: "Real model",
    architecture: "qwen4exp",
  };
  const profiles = [createProfile(model, 8190), createProfile(vector, 8191)];
  const inventory = {
    root,
    filesScanned: 2,
    models: [model, vector],
    components: [],
    errors: [],
  };
  assert.equal(repairInventory(inventory).models.length, 1);
  assert.equal(inventory.models.length, 2);
  await writeFile(join(root, "profiles.json"), JSON.stringify(profiles));
  await writeFile(join(root, "inventory.json"), JSON.stringify(inventory));
  const service = new StrataService({ dataDir: root });
  await service.init();
  assert.deepEqual(
    service.profiles.map((p) => p.name),
    ["Real model"],
  );
  assert.equal(service.inventory.components[0].role, "Control vector");
  assert.equal(
    (await service.store.read("component-profiles", []))[0].id,
    profiles[1].id,
  );
  assert.equal(await readFile(path, "utf8"), "original vector");
  service.inventory.models.push(vector);
  await assert.rejects(() => service.addModels(["vector"]), /complete/);
  await service.dispose();
  const reopened = new StrataService({ dataDir: root });
  await reopened.init();
  assert.equal((await reopened.store.read("component-profiles", [])).length, 1);
  assert.equal(reopened.inventory.components.length, 1);
  await reopened.dispose();
});
