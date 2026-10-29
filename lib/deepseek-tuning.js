import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// This is the unchanged upstream DeepSeek tuner already pinned in the repository.
export const deepseekTuner = fileURLToPath(
  new URL("../vendor/gyro-l-control/tools/dsv41/tune.py", import.meta.url),
);
const flags = ["--dspark", "--dspark-conf", "--dspark-block", "--cpu-threads"];

export function isDeepSeek(profile) {
  return [profile.model?.architecture, profile.config?.arch].some((arch) =>
    ["deepseek4", "deepseek41"].includes(arch),
  );
}

function value(args, flag) {
  const index = args.lastIndexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

function without(args, omitted) {
  return args.filter(
    (_arg, index) =>
      !omitted.includes(args[index - 1]) && !omitted.includes(args[index]),
  );
}

function resultFrom(stdout) {
  for (const line of stdout.split("\n").reverse()) {
    try {
      const result = JSON.parse(line).result;
      if (
        result?.speeds &&
        Array.isArray(result.changed) &&
        Array.isArray(result.lines)
      )
        return result;
    } catch {
      // The native CLI mixes progress sentences and a final JSON result.
    }
  }
  throw new Error("The DeepSeek tuner did not return a measurement report");
}

/** Run upstream policy against a private config; failed/cancelled runs never edit the saved profile. */
export async function tuneDeepSeek(
  profile,
  baseline,
  directory,
  runtime,
  execute,
  env,
  signal,
  report,
) {
  const path = join(directory, "deepseek.json");
  const config = structuredClone(baseline);
  config.lib_dirs = [
    ...new Set([dirname(config.exe), ...(config.lib_dirs || [])]),
  ];
  await writeFile(path, JSON.stringify(config), { mode: 0o600 });
  const metrics = {
    phase: "measuring",
    tuner: "deepseek41",
    prefillTokS: null,
    decodeTokS: null,
  };
  report("DeepSeek native Thorough tuning", metrics);
  let pending = "";
  const output = await execute(
    runtime.python,
    [
      "-B",
      deepseekTuner,
      "--config",
      path,
      "--mode",
      "thorough",
      "--output",
      "json",
    ],
    {
      signal,
      env: { ...env, ...config.env },
      timeout: 3 * 60 * 60 * 1000,
      onData(chunk) {
        pending += chunk;
        const lines = pending.split("\n");
        pending = lines.pop();
        for (const line of lines) {
          if (!line.trim() || line.trim().startsWith("{")) continue;
          const speed = line.match(/([\d.]+) tokens a second/);
          if (speed && Number(speed[1]) > 0)
            metrics.decodeTokS = Number(speed[1]);
          report(line.trim(), metrics);
        }
      },
    },
  );
  signal?.throwIfAborted();
  const result = resultFrom(output.stdout);
  const speeds = Object.values(result.speeds);
  // The native tuner exits zero even when the baseline, tokenizer or every candidate failed.
  if (
    speeds.length < 2 ||
    speeds.some((speed) => !Number.isFinite(speed) || speed <= 0) ||
    !result.speeds.standard
  )
    throw new Error(
      result.lines.join(" ") ||
        "DeepSeek could not compare valid measurements; saved settings were kept",
    );
  const measured = JSON.parse(await readFile(path, "utf8"));
  const originalArgs = baseline.args || [];
  if (
    !Array.isArray(measured.args) ||
    measured.args.some((arg) => typeof arg !== "string") ||
    JSON.stringify(
      without(
        originalArgs.filter((arg) => arg !== "--serve"),
        flags,
      ),
    ) !==
      JSON.stringify(
        without(
          measured.args.filter((arg) => arg !== "--serve"),
          flags,
        ),
      )
  )
    throw new Error(
      "The DeepSeek tuner changed settings outside its supported controls; saved settings were kept",
    );
  const updated = structuredClone(profile);
  updated.config.lib_dirs = config.lib_dirs;
  // Change only the native tuner's controls. Preserve other advanced flags and avoid duplicate overrides.
  for (const flag of flags) {
    const chosen = value(measured.args, flag);
    if (chosen === value(originalArgs, flag)) continue;
    updated.config.args = without(updated.config.args, [flag]);
    updated.extraArgs = without(updated.extraArgs, [flag]);
    if (chosen !== undefined) updated.config.args.push(flag, chosen);
  }
  if (result.changed.length && !measured.tuned?.dsv41)
    throw new Error(
      "DeepSeek reported an improvement without saving its configuration",
    );
  if (measured.tuned?.dsv41) {
    updated.config.tuned ||= {};
    updated.config.tuned.dsv41 = measured.tuned.dsv41;
  }
  const best = result.changed.length
    ? result.speeds[result.changed.at(-1)]
    : result.speeds.standard;
  if (!Number.isFinite(best) || best <= 0)
    throw new Error("DeepSeek returned an incomplete winning measurement");
  updated.tuneReport = {
    tuner: "deepseek41",
    mode: "thorough",
    outcome: result.changed.length ? "improved" : "default_confirmed",
    message: result.lines.join(" "),
    changed: result.changed,
    speeds: result.speeds,
    values: {
      base_tok_s: result.speeds.standard,
      tuned_tok_s: best,
      gain_decode_pct: 100 * (best / result.speeds.standard - 1),
    },
    settings: {
      args: Object.fromEntries(
        flags
          .filter((flag) => value(measured.args, flag) !== undefined)
          .map((flag) => [flag, value(measured.args, flag)]),
      ),
    },
  };
  updated.applyPreset = false; // DeepSeek writes launch args, not a Qwen preset ID.
  report(updated.tuneReport.message, { ...metrics, decodeTokS: best });
  return updated;
}
