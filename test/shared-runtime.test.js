import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrataService } from "../lib/service.js";

test("existing managed DeepSeek profiles migrate runtime paths without repacking weights or losing tuning", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "deepseek-shared-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const old = join(
    root,
    "models",
    "old",
    "engine-dsv41",
    "0.1.52",
    "strata-dsv41",
  );
  const p = {
    id: "old",
    model: { architecture: "deepseek41" },
    runtime: {},
    config: {
      exe: old,
      args: ["--pack", "/unchanged/weights"],
      lib_dirs: [join(old, ".."), "/other-library"],
    },
    tuneReport: { saved: true },
  };
  service.profiles = [p];
  let calls = 0;
  const shared = join(
    root,
    "runtime",
    "deepseek",
    "engine-dsv41",
    "0.1.52",
    "strata-dsv41",
  );
  service.bridge = async (action, payload) => {
    calls++;
    assert.equal(action, "deepseek-runtime");
    assert.equal(payload.legacyModelsRoot, join(root, "models"));
    return { exe: shared, lib_dirs: [join(shared, "..")] };
  };
  await service.prepare(p.id, new AbortController().signal, () => {});
  await service.prepare(p.id, new AbortController().signal, () => {});
  assert.equal(calls, 1);
  assert.equal(p.config.exe, shared);
  assert.deepEqual(p.config.args, ["--pack", "/unchanged/weights"]);
  assert.deepEqual(p.tuneReport, { saved: true });
  assert.ok(p.config.lib_dirs.includes("/other-library"));
  p.runtime.executable = "/custom/strata-dsv41";
  p.config.exe = old;
  await service.prepare(p.id, new AbortController().signal, () => {});
  assert.equal(calls, 1);
  p.runtime.executable = "";
  p.environment = { STRATA_DSV41_EXE: "/custom/strata-dsv41" };
  await service.prepare(p.id, new AbortController().signal, () => {});
  assert.equal(calls, 1);
});

test("file preparation finishes before tuning requests a GPU lease", async () => {
  const service = new StrataService();
  service.profiles = [
    { id: "p", name: "Model", model: { architecture: "deepseek41" } },
  ];
  const events = [];
  let finish;
  const waiting = new Promise((resolve) => (finish = resolve));
  service.prepare = async () => {
    events.push("prepare");
    await waiting;
    events.push("prepared");
  };
  service.scheduler = {
    async acquire() {
      events.push("GPU");
      return {
        signal: new AbortController().signal,
        release() {
          events.push("release");
        },
      };
    },
    async unload() {
      events.push("unload");
    },
  };
  service.tuneLocal = async () => events.push("measure");
  const tuning = service.tune("p", new AbortController().signal, () => {});
  await Promise.resolve();
  assert.deepEqual(events, ["prepare"]);
  finish();
  await tuning;
  assert.deepEqual(events, [
    "prepare",
    "prepared",
    "GPU",
    "measure",
    "release",
    "unload",
  ]);
});

test("an idle model does not pin the GPU just because a preparation job exists", async () => {
  const service = new StrataService();
  service.profiles = [{ id: "p", name: "Model", gpu: 0 }];
  service.jobs.items.set("job", { status: "running" });
  service.servers.set("p", { active: 0 });
  assert.equal(service.driver("p").busy(), false);
  assert.throws(
    () => service.driver("p").load(new AbortController().signal),
    /Wait for setup/,
  );
  service.servers.get("p").active = 1;
  assert.equal(service.driver("p").busy(), true);
});

test("operation card distinguishes preparation and waiting from measurement", async () => {
  const { build } = await import("esbuild");
  const vm = await import("node:vm");
  const compiled = await build({
    entryPoints: [
      new URL("../client/Operations.jsx", import.meta.url).pathname,
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react"],
  });
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  const context = {
    module: { exports: {} },
    exports: {},
    require: (name) => {
      assert.equal(name, "react");
      return react;
    },
  };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  for (const phase of ["preparing", "waiting", "measuring"]) {
    const job = {
      id: "job",
      kind: "Tune models",
      status: "running",
      progress: "Progress",
      metrics: { phase, tuner: "deepseek41", decodeTokS: null },
    };
    const text = JSON.stringify(
      context.module.exports.Operations({ jobs: [job], run: () => {} }),
    );
    if (phase === "preparing") {
      assert.match(text, /Preparing model/);
      assert.doesNotMatch(text, /Measuring/);
    }
    if (phase === "waiting") {
      assert.match(text, /Waiting for GPU/);
      assert.doesNotMatch(text, /Measuring/);
    }
    if (phase === "measuring") assert.match(text, /Measuring/);
  }
});
