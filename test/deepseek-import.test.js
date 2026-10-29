import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrataService } from "../lib/service.js";
import { createProfile } from "../lib/profiles.js";
import { modelSetupIssue } from "../lib/runtime.js";
import { StrataAdapter } from "../lib/adapter.js";

test("DeepSeek preparation repairs stale importer rejection and preserves its engine libraries", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "deepseek-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const p = createProfile(
    {
      name: "DeepSeek 1017",
      architecture: "deepseek41",
      status: "complete",
      setupIssue: "Local preparation for this architecture is unavailable",
      files: [],
    },
    8190,
  );
  service.profiles = [p];
  service.settings = {
    python: "python3",
    controlDir: "/control",
    executable: "/qwen/strata",
  };
  assert.equal(p.kv, "engine");
  assert.equal(modelSetupIssue(p.model, service.settings), null);
  service.engineHelp = async () => {
    throw Error("Must not borrow Qwen KV capabilities");
  };
  service.bridge = async (action, payload) => {
    assert.equal(action, "prepare");
    assert.equal(payload.profile.model.architecture, "deepseek41");
    return {
      exe: "/deepseek/strata-dsv41",
      arch: "deepseek41",
      args: ["--pack", "/pack"],
      lib_dirs: ["/deepseek/private"],
    };
  };
  await service.prepare(p.id, new AbortController().signal, () => {});
  assert.ok(p.config.lib_dirs.includes("/deepseek/private"));
  assert.ok(p.config.lib_dirs.includes("/deepseek"));
  assert.deepEqual(await service.action("capabilities", { id: p.id }), {
    kv: ["engine"],
  });
  p.projector = "/wrong-flash-next-mmproj.gguf";
  const adapter = new StrataAdapter({ get: () => undefined }, service);
  assert.deepEqual((await adapter.listModels("strata"))[0].inputModalities, [
    "text",
  ]);
});

test("DeepSeek editor exposes context and explains DSpark without Qwen KV or projector controls", async () => {
  const { build } = await import("esbuild");
  const vm = await import("node:vm");
  const compiled = await build({
    entryPoints: [
      new URL("../client/ProfileEditor.jsx", import.meta.url).pathname,
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react"],
  });
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children,
    }),
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  };
  const context = {
    module: { exports: {} },
    exports: {},
    require: (name) => {
      assert.equal(name, "react");
      return react;
    },
    structuredClone,
  };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const profile = createProfile(
    {
      name: "DeepSeek 1017",
      architecture: "deepseek41",
      files: [{ index: 1, metadata: { "deepseek41.context_length": 1048576 } }],
    },
    8190,
  );
  const tree = context.module.exports.ProfileEditor({
    profile,
    busy: false,
    save: () => {},
    run: () => {},
    close: () => {},
  });
  const nodes = (value) =>
    Array.isArray(value)
      ? value.flatMap(nodes)
      : value && typeof value === "object"
        ? [value, ...nodes(value.children)]
        : [];
  assert.equal(nodes(tree).filter((node) => node.type === "select").length, 1);
  const text = JSON.stringify(tree);
  assert.match(text, /Engram table and DSpark/);
  assert.match(text, /No selectable KV format/);
  assert.doesNotMatch(text, /Select mmproj file/);
});

test("DeepSeek leaves conversation snapshots to its native slot cache", async () => {
  const service = new StrataService();
  service.checkpointRequest = async () => {
    throw Error("Qwen snapshot protocol must not be sent to DeepSeek");
  };
  const state = { profile: { model: { architecture: "deepseek41" } } };
  await service.restoreCheckpoint(state, { sessionId: "chat" });
  await service.saveCheckpoint(state, { sessionId: "chat" });
});
