import test from "node:test";
import assert from "node:assert/strict";
import { modelRuntime, modelSetupIssue } from "../lib/runtime.js";
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
