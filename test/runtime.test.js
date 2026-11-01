import test from "node:test";
import assert from "node:assert/strict";
import {
  modelRuntime,
  modelSetupIssue,
  migrateManagedRuntime,
} from "../lib/runtime.js";
import { createProfile, validateProfile } from "../lib/profiles.js";
const stock = {
  controlDir: "/stock",
  python: "/python",
  executable: "/stock/strata",
};
const model = {
  name: "Gyro L",
  id: "gyro-l",
  status: "complete",
  architecture: "qwen4exp",
  setupIssue: "Stock encoding unsupported",
  files: [{ encodings: { 147: 1, 148: 1, 149: 1 } }],
};
test("a model fork does not replace the stock runtime for other models", () => {
  const profile = {
    runtime: { controlDir: "/fork", executable: "/fork/strata", tqp: true },
  };
  assert.deepEqual(modelRuntime(stock, profile), {
    ...stock,
    controlDir: "/fork",
    executable: "/fork/strata",
    tqp: true,
  });
  assert.deepEqual(modelRuntime(stock, {}), { ...stock, tqp: false });
  assert.equal(modelSetupIssue(model, modelRuntime(stock, profile)), null);
  assert.equal(
    modelSetupIssue(model, modelRuntime(stock, {})),
    model.setupIssue,
  );
  assert.equal(
    modelSetupIssue(
      { ...model, files: [{ encodings: { 147: 1, 999: 1 } }] },
      modelRuntime(stock, profile),
    ),
    model.setupIssue,
  );
});
test("enabling Gyro L requires explicit fork paths", () => {
  const profile = createProfile(model, 8190);
  assert.throws(
    () => validateProfile({ ...profile, runtime: { tqp: true } }),
    /fork Control/,
  );
  assert.equal(
    validateProfile({
      ...profile,
      runtime: { tqp: true, controlDir: "/fork", executable: "/fork/strata" },
    }).runtime.tqp,
    true,
  );
});

test("bundled runtimes select the TQP fork by tensor encodings without replacing stock", () => {
  const settings = {
    ...stock,
    fork: {
      controlDir: "/bundled/fork",
      executable: "/bundled/gyro-l/strata",
      python: "/python",
      tqp: true,
    },
  };
  const selected = modelRuntime(settings, {
    model,
    runtime: { tqp: false, controlDir: "", executable: "", python: "" },
  });
  assert.equal(selected.executable, "/bundled/gyro-l/strata");
  assert.equal(selected.tqp, true);
  assert.equal(
    modelRuntime(settings, { model: { files: [{ encodings: { 143: 1 } }] } })
      .executable,
    stock.executable,
  );
});

test("managed runtime upgrades preserve tuned arguments and external overrides", () => {
  const p = {
    runtime: {},
    config: {
      exe: "/data/runtime/0.5.0/engine/strata",
      cwd: "/data/runtime/0.5.0/control",
      args: ["--native", "/unchanged/model", "--prefill-chunk", "4096"],
      lib_dirs: ["/data/runtime/0.5.0/engine", "/external/libs"],
      repeat_stop_tokens: 0,
    },
  };
  const runtime = {
    executable: "/data/runtime/0.8.0/engine/strata",
    controlDir: "/data/runtime/0.8.0/control",
  };
  const args = structuredClone(p.config.args);
  assert.equal(migrateManagedRuntime(p, runtime, "/data/runtime"), true);
  assert.deepEqual(p.config.args, args);
  assert.equal(p.config.repeat_stop_tokens, 0);
  assert.deepEqual(p.config.lib_dirs, [
    "/data/runtime/0.8.0/engine",
    "/external/libs",
  ]);
  assert.equal(migrateManagedRuntime(p, runtime, "/data/runtime"), false);
  p.runtime.executable = "/custom/engine";
  assert.equal(
    migrateManagedRuntime(
      p,
      { ...runtime, executable: "/new/engine" },
      "/data/runtime",
    ),
    false,
  );
});
