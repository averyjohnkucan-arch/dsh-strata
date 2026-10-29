import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProfile } from "../lib/profiles.js";
import { StrataService } from "../lib/service.js";
import { StrataAdapter } from "../lib/adapter.js";
import { modelLabel } from "../client/model-label.js";

test("custom names remain verbatim while default model filenames retain compact labels", () => {
  const name = "Qwen3.8-Flash-Next-Gyro-S-TQ1_0";
  const p = { name, model: { name } };
  assert.equal(modelLabel(p).name, "Gyro S · TQ1_0");
  const renamed = { ...p, name: "My Flash-Next-256K model" };
  assert.equal(modelLabel(renamed).name, renamed.name);
  assert.equal(modelLabel(renamed).family, modelLabel(p).family);
});

test("renaming persists to DSH's model picker without changing model identity or tuning", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-model-name-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(
    { name: "Original model", architecture: "qwen4exp", files: [] },
    8190,
  );
  p.tuneReport = { preset: { id: "keep-native-tune" } };
  service.profiles = [p];
  await service.save({ ...p, name: "My 256K model" });
  const reloaded = new StrataService({ dataDir: root });
  await reloaded.init();
  t.after(() => reloaded.dispose());
  const saved = reloaded.profile(p.id);
  assert.equal(saved.name, "My 256K model");
  assert.deepEqual(saved.model, p.model);
  assert.deepEqual(saved.tuneReport, p.tuneReport);
  assert.equal(saved.context, p.context);
  const models = await new StrataAdapter({}, reloaded).listModels("strata");
  assert.equal(models[0].name, saved.name);
  assert.equal(models[0].id, p.id);
});

test("the model-name editor saves the new name and retains launch overrides", async () => {
  const { build } = await import("esbuild");
  const { default: vm } = await import("node:vm");
  const { fileURLToPath } = await import("node:url");
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL("../client/ProfileEditor.jsx", import.meta.url)),
    ],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    external: ["react"],
  });
  const states = [];
  let cursor = 0,
    saved;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states))
        states[index] = typeof initial === "function" ? initial() : initial;
      return [
        states[index],
        (value) => {
          states[index] =
            typeof value === "function" ? value(states[index]) : value;
        },
      ];
    },
    useRef() {
      return { current: null };
    },
    useEffect() {},
    createElement(type, props, ...children) {
      return { type, props: props || {}, children };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    structuredClone,
    require: (name) => {
      assert.equal(name, "react");
      return react;
    },
  });
  const p = createProfile(
    { name: "Original model", architecture: "qwen4exp", files: [] },
    8190,
  );
  p.environment = { OMP_NUM_THREADS: "4" };
  p.extraArgs = ["--pool-workers", "12"];
  p.applyPreset = false;
  const render = () => {
    cursor = 0;
    return module.exports.ProfileEditor({
      profile: p,
      busy: false,
      save: async (value) => {
        saved = value;
      },
      run: async () => {},
      close() {},
    });
  };
  function find(value, matches) {
    if (Array.isArray(value))
      return value.map((item) => find(item, matches)).find(Boolean);
    if (!value || typeof value !== "object") return null;
    return matches(value) ? value : find(value.children, matches);
  }
  const input = find(
    render(),
    (node) => node.type === "input" && node.props.value === p.name,
  );
  assert.ok(input);
  input.props.onChange({ target: { value: "My renamed model" } });
  const button = find(
    render(),
    (node) => node.type === "button" && node.children.includes("Save"),
  );
  assert.ok(button);
  await button.props.onClick();
  assert.equal(saved.name, "My renamed model");
  assert.deepEqual(saved.environment, p.environment);
  assert.deepEqual(saved.extraArgs, p.extraArgs);
  assert.equal(saved.applyPreset, false);
  assert.equal(saved.id, p.id);
});
