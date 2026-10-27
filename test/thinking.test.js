import test from "node:test";
import assert from "node:assert/strict";
import {
  supportsProjection,
  thinkingInfo,
  thinkingPreset,
} from "../lib/thinking.js";
import { createProfile } from "../lib/profiles.js";
import { nativeContext, contextChoices } from "../lib/choices.js";
import { StrataService } from "../lib/service.js";
const model = {
  name: "Qwen3.8-Flash-Next-Gyro-S",
  architecture: "qwen4exp",
  files: [
    {
      index: 1,
      metadata: {
        "qwen4exp.block_count": 48,
        "qwen4exp.context_length": 262144,
      },
    },
  ],
};
test("new models default to their native GGUF context, including a non-step native size", () => {
  const p = createProfile(model, 8190);
  assert.equal(p.context, 262144);
  assert.equal(nativeContext(p), 262144);
  const other = createProfile(
    {
      ...model,
      files: [{ index: 1, metadata: { "qwen4exp.context_length": 100000 } }],
    },
    8191,
  );
  assert.equal(other.context, 100000);
  assert.ok(contextChoices(other).includes(100000));
  assert.ok(contextChoices(other).includes(98304));
});
test("four labels use distinct native effort/projection combinations only on compatible models", () => {
  const p = createProfile(model, 8190);
  assert.deepEqual(
    thinkingInfo(p).efforts.map((x) => x.name),
    ["Low", "Medium", "High", "Uncensored"],
  );
  assert.deepEqual(
    ["low", "medium", "high", "uncensored"].map((x) => thinkingPreset(p, x)),
    [
      { effort: "low", projection: false },
      { effort: "medium", projection: false },
      { effort: "xhigh", projection: false },
      { effort: "xhigh", projection: true },
    ],
  );
  assert.equal(
    supportsProjection({ ...p, model: { ...model, name: "Swift 1.5" } }),
    false,
  );
  assert.equal(
    supportsProjection({
      ...p,
      model: { ...model, architecture: "qwen35moe" },
    }),
    false,
  );
  assert.throws(
    () =>
      thinkingPreset({ model: { architecture: "qwen35moe" } }, "uncensored"),
    /Unsupported/,
  );
});
test("the native vector is loaded with ordinary requests off, and disk caches are partitioned by projection", () => {
  const p = createProfile(model, 8190);
  p.config = { exe: "/engine", args: [], env: {} };
  const service = new StrataService(),
    a = service.launchConfig(p),
    b = service.launchConfig(p);
  assert.deepEqual(a, b);
  assert.equal(a.args.filter((x) => x === "--control-vector-scaled").length, 1);
  assert.equal(a.sampling.experimental_speed_projection, false);
  assert.deepEqual(p.config.args, []);
  assert.notEqual(
    service.checkpointSignature(
      { checkpointSignature: "model" },
      { projection: false },
    ),
    service.checkpointSignature(
      { checkpointSignature: "model" },
      { projection: true },
    ),
  );
});
