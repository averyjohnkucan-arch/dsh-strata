import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { StrataService } from "../lib/service.js";
import { createProfile, runConfig } from "../lib/profiles.js";
import { deepseekTuner, isDeepSeek } from "../lib/deepseek-tuning.js";
import { execute } from "../lib/process.js";

async function fixture(t, runner) {
  const root = await mkdtemp(join(tmpdir(), "strata-deepseek-tune-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root }, () => {}, runner);
  await service.init();
  t.after(() => service.dispose());
  service.settings = {
    controlDir: "/control",
    python: "python3",
    executable: "/qwen-engine",
  };
  const p = createProfile(
    { name: "DeepSeek 1017", architecture: "deepseek4", files: [] },
    8190,
  );
  p.context = 32768;
  p.config = {
    exe: "/deepseek/strata-dsv41",
    arch: "deepseek41",
    args: [
      "--pack",
      "/model/pack",
      "--max-context",
      "8192",
      "--dspark",
      "auto",
    ],
    env: { MODEL_TEST: "retained" },
  };
  p.extraArgs = ["--window", "16", "--dspark", "off"];
  p.tuneReport = { preset: { id: "old-preserved-on-failure" } };
  service.profiles = [p];
  return { root, service, p };
}

function response(result) {
  return { stdout: JSON.stringify({ result }) + "\n", stderr: "" };
}

const improved = {
  changed: ["the drafter on (DSpark)"],
  speeds: { standard: 10, "the drafter on (DSpark)": 12 },
  lines: ["Done: answers 20% faster."],
};

test("DeepSeek uses the repo tuner and persists measured args without duplicate overrides or Qwen presets", async (t) => {
  let calls = 0;
  const { root, service, p } = await fixture(
    t,
    async (python, args, options) => {
      calls++;
      assert.equal(python, "python3");
      assert.equal(args[1], deepseekTuner);
      assert.equal(args[args.indexOf("--mode") + 1], "thorough");
      assert.equal(options.env.MODEL_TEST, "retained");
      const config = args[args.indexOf("--config") + 1];
      const cfg = JSON.parse(await readFile(config, "utf8"));
      assert.equal(cfg.exe, "/deepseek/strata-dsv41");
      assert.equal(cfg.args[cfg.args.indexOf("--max-context") + 1], "32768");
      cfg.args = cfg.args.filter(
        (arg, i, all) => arg !== "--dspark" && all[i - 1] !== "--dspark",
      );
      cfg.args.push("--dspark", "on", "--dspark-conf", "0.65");
      cfg.tuned = { dsv41: improved };
      await writeFile(config, JSON.stringify(cfg));
      options.onData(
        "  standard settings: 10.00 tokens a second\n    12.00 tokens a second\n",
      );
      return response(improved);
    },
  );
  const metrics = [];
  const report = await service.tune(
    p.id,
    new AbortController().signal,
    (_text, value) => metrics.push({ ...value }),
  );
  assert.equal(calls, 1);
  assert.equal(report.tuner, "deepseek41");
  assert.equal(report.values.tuned_tok_s, 12);
  const saved = service.profile(p.id);
  assert.equal(saved.applyPreset, false);
  assert.deepEqual(saved.extraArgs, ["--window", "16"]);
  assert.equal(
    runConfig(saved).args.filter((arg) => arg === "--dspark").length,
    1,
  );
  assert.equal(runConfig(saved).args.at(-1), "16");
  assert.equal(
    runConfig(saved).args[runConfig(saved).args.indexOf("--dspark") + 1],
    "on",
  );
  assert.ok(
    metrics.some(
      (value) => value.tuner === "deepseek41" && value.decodeTokS === 12,
    ),
  );
  const restarted = new StrataService({ dataDir: root });
  await restarted.init();
  t.after(() => restarted.dispose());
  assert.deepEqual(restarted.profile(p.id).tuneReport, report);
  assert.deepEqual(runConfig(restarted.profile(p.id)), runConfig(saved));
});

test("DeepSeek unchanged measurements succeed without requiring a Qwen preset ID", async (t) => {
  const { service, p } = await fixture(t, async () =>
    response({
      changed: [],
      speeds: { standard: 10, candidate: 10.2 },
      lines: ["Standard settings retained."],
    }),
  );
  const args = structuredClone(p.config.args);
  const result = await service.tune(
    p.id,
    new AbortController().signal,
    () => {},
  );
  assert.equal(result.outcome, "default_confirmed");
  assert.equal(result.values.tuned_tok_s, 10);
  assert.deepEqual(service.profile(p.id).config.args, args);
});

for (const result of [
  { changed: [], speeds: {}, lines: ["The standard settings did not finish."] },
  {
    changed: [],
    speeds: { standard: 10 },
    lines: ["Only the standard settings could be timed."],
  },
])
  test(
    "DeepSeek zero exit with failed or incomplete measurement preserves the previous tune: " +
      JSON.stringify(result.speeds),
    async (t) => {
      const { service, p } = await fixture(t, async () => response(result));
      const before = structuredClone(p);
      await assert.rejects(
        () => service.tune(p.id, new AbortController().signal, () => {}),
        /standard settings/,
      );
      assert.deepEqual(service.profile(p.id), before);
    },
  );

test("DeepSeek cancellation leaves saved configuration unchanged", async (t) => {
  const controller = new AbortController();
  const { service, p } = await fixture(t, async () => {
    controller.abort();
    return response(improved);
  });
  const before = structuredClone(p);
  await assert.rejects(
    () => service.tune(p.id, controller.signal, () => {}),
    /abort/i,
  );
  assert.deepEqual(service.profile(p.id), before);
});

test("DeepSeek rejects a tuner result that changes model/context controls", async (t) => {
  const { service, p } = await fixture(t, async (_python, args) => {
    const config = args[args.indexOf("--config") + 1];
    const cfg = JSON.parse(await readFile(config, "utf8"));
    cfg.args.push("--max-context", "4096");
    await writeFile(config, JSON.stringify(cfg));
    return response(improved);
  });
  const before = structuredClone(p);
  await assert.rejects(
    () => service.tune(p.id, new AbortController().signal, () => {}),
    /outside its supported controls/,
  );
  assert.deepEqual(service.profile(p.id), before);
});

test("DeepSeek persistence failure does not replace the live profile", async (t) => {
  const { service, p } = await fixture(t, async () =>
    response({
      changed: [],
      speeds: { standard: 10, candidate: 10.2 },
      lines: [],
    }),
  );
  const before = structuredClone(p);
  service.store.write = async () => {
    throw Error("disk full");
  };
  await assert.rejects(
    () => service.tune(p.id, new AbortController().signal, () => {}),
    /disk full/,
  );
  assert.deepEqual(service.profile(p.id), before);
});

test("the bundled tuner is the exact upstream tool and both DeepSeek architecture names dispatch to it", async () => {
  assert.equal(
    createHash("sha256")
      .update(await readFile(deepseekTuner))
      .digest("hex"),
    "bb75873d33774cc5d27525e4af0693eb9d6cb2a72dc9d92c50426d3651b1fab0",
  );
  for (const arch of ["deepseek4", "deepseek41"])
    assert.equal(isDeepSeek({ model: { architecture: arch } }), true);
  assert.equal(isDeepSeek({ model: { architecture: "qwen4exp" } }), false);
});

test("real upstream tuner CLI drives engine subprocesses and keeps only measured improvements", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "deepseek-native-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fake = join(root, "engine");
  await writeFile(
    fake,
    `#!/usr/bin/env python3\nimport sys,os\na=sys.argv[1:]\nassert '--ids' in a and '--n' in a\nassert os.environ['MODEL_TEST']=='retained'\nv=120 if '--dspark' in a and a[a.index('--dspark')+1]=='on' else 100\nprint(f'decode: 48 tokens in 400 ms ({v} tok/s)',file=sys.stderr)\n`,
    { mode: 0o755 },
  );
  const driver = join(root, "driver.py");
  // Token IDs are a fixture: exercise native measurement, selection and config writing without model weights.
  await writeFile(
    driver,
    `import importlib.util,sys\nspec=importlib.util.spec_from_file_location('native_tune',sys.argv.pop(1))\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.prompt_ids=lambda _: [1,2,3]\nm.physical_cores=lambda: 2\nm.os.cpu_count=lambda: 4\nraise SystemExit(m.main())\n`,
  );
  const config = join(root, "config.json");
  await writeFile(
    config,
    JSON.stringify({
      exe: fake,
      args: ["--pack", root, "--max-context", "8192", "--dspark", "auto"],
    }),
  );
  const result = await execute(
    "python3",
    [
      "-B",
      driver,
      deepseekTuner,
      "--config",
      config,
      "--mode",
      "thorough",
      "--output",
      "json",
    ],
    { env: { MODEL_TEST: "retained" } },
  );
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1)).result;
  assert.equal(report.speeds.standard, 100);
  assert.equal(report.speeds[report.changed.at(-1)], 120);
  assert.equal(report.changed.length, 1);
  const saved = JSON.parse(await readFile(config, "utf8"));
  assert.equal(saved.args[saved.args.indexOf("--dspark") + 1], "on");
  assert.equal(saved.args[saved.args.indexOf("--max-context") + 1], "8192");
});

test("the model menu exposes DeepSeek auto-tune and keeps Qwen's existing action", async () => {
  const { build } = await import("esbuild");
  const { default: vm } = await import("node:vm");
  const { fileURLToPath } = await import("node:url");
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL("../client/ModelList.jsx", import.meta.url)),
    ],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    external: ["react"],
  });
  const react = {
    useState: (initial) => [initial, () => {}],
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children,
    }),
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    require: () => react,
  });
  const profiles = ["deepseek4", "qwen4exp"].map((architecture) =>
    createProfile({ name: architecture, architecture, files: [] }, 8190),
  );
  const calls = [];
  const tree = module.exports.ModelList({
    profiles,
    busy: false,
    open() {},
    run: (...args) => calls.push(args),
  });
  function find(value, label) {
    if (Array.isArray(value))
      return value.map((item) => find(item, label)).find(Boolean);
    if (!value || typeof value !== "object") return null;
    return value.type === "button" && value.children.includes(label)
      ? value
      : find(value.children, label);
  }
  const deepseek = find(tree, "Auto-tune DeepSeek");
  const qwen = find(tree, "Auto-tune");
  assert.ok(deepseek);
  assert.ok(qwen);
  const menu = { open: true };
  deepseek.props.onClick({ currentTarget: { closest: () => menu } });
  assert.equal(menu.open, false);
  assert.equal(calls[0][0], "tune");
  assert.equal(calls[0][1].id, profiles[0].id);
});
