import { randomUUID } from "node:crypto";
import { contextStep, kvChoices, kvLabel, kvArgument } from "./choices.js";

export const tuneDefaults = Object.freeze({ mode: "thorough" });

export function createProfile(model, port) {
  const metadata = model.files.find((file) => file.index === 1)?.metadata || {};
  const trainedContext =
    Number(metadata[model.architecture + ".context_length"]) || contextStep;
  return {
    id: randomUUID(),
    name: model.name,
    model,
    context: Math.max(4096, Math.min(contextStep, trainedContext)),
    port,
    gpu: 0,
    kv: "FP16/FP16",
    projector: "",
    mtp: "",
    vision: "cpu",
    extraArgs: [],
    environment: {},
    tune: { ...tuneDefaults },
    applyPreset: true,
    runtime: { controlDir: "", python: "", executable: "", tqp: false },
    config: null,
  };
}

export function validateProfile(profile) {
  const p = structuredClone(profile);
  delete p.status;
  if (
    !/^[a-zA-Z0-9-]{1,100}$/.test(p.id) ||
    typeof p.name !== "string" ||
    !p.name.trim()
  )
    throw new Error("Give the model a valid name and ID");
  for (const [key, min, max] of [
    ["port", 1024, 65535],
    ["gpu", 0, 255],
    ["context", 4096, 4_194_304],
  ])
    if (!Number.isInteger(p[key]) || p[key] < min || p[key] > max)
      throw new Error(`Invalid ${key}`);
  if (
    !Array.isArray(p.extraArgs) ||
    p.extraArgs.some((arg) => typeof arg !== "string")
  )
    throw new Error("Engine arguments must be a JSON array of strings");
  if (
    !p.environment ||
    Array.isArray(p.environment) ||
    typeof p.environment !== "object" ||
    Object.values(p.environment).some((value) => typeof value !== "string")
  )
    throw new Error("Environment must be a JSON object of strings");
  // These fields define file identity and transport; their dedicated controls own them.
  const reserved =
    /^(--(?:native|pack|model|host|port|max-context|ctx|kv|conversation-cache-mib))(?:=|$)/;
  if (p.extraArgs.some((arg) => reserved.test(arg)))
    throw new Error("Use the dedicated model, context, KV and port controls");
  p.runtime = {
    controlDir: "",
    python: "",
    executable: "",
    tqp: false,
    ...p.runtime,
  };
  for (const key of ["controlDir", "python", "executable"])
    if (typeof p.runtime[key] !== "string")
      throw new Error("Invalid model runtime paths");
  if (typeof p.runtime.tqp !== "boolean")
    throw new Error("Invalid TQP runtime setting");
  if (p.runtime.tqp && (!p.runtime.controlDir || !p.runtime.executable))
    throw new Error(
      "Gyro L requires the fork Control directory and engine executable",
    );
  const native = p.model?.architecture === "qwen35moe";
  if (![...kvChoices, "Q8/Q4", "fp32", "engine"].includes(kvLabel(p.kv)))
    throw new Error("KV format is unsupported by this Strata model");
  if (p.dflash)
    throw new Error(
      "Stock Strata does not accept a DFlash sidecar through this importer",
    );
  if (native && p.mtp)
    throw new Error(
      "Stock Qwen uses embedded MTP; external MTP donors are unsupported",
    );
  // Upstream owns the search policy and resource defaults, including legacy profiles.
  return { ...p, tune: { ...tuneDefaults } };
}

export function runConfig(profile) {
  if (!profile.config) throw new Error("Prepare this model first");
  const config = structuredClone(profile.config);
  if (profile.model?.architecture === "deepseek4") {
    // DeepSeek has a separate CLI. Preserve the configuration created by stock setup.
    return {
      ...config,
      args: [...config.args, ...profile.extraArgs],
      model_name: profile.id,
      port: profile.port,
      gpu: profile.gpu,
      host: "127.0.0.1",
      open_browser: false,
      env: { ...config.env, ...profile.environment },
    };
  }
  const args = [];
  for (let i = 0; i < config.args.length; i++) {
    if (
      ["--max-context", "--kv", "--conversation-cache-mib"].includes(
        config.args[i],
      )
    ) {
      i++;
      continue;
    }
    args.push(config.args[i]);
  }
  args.push("--max-context", String(profile.context));
  if (!["fp32", "engine"].includes(profile.kv))
    args.push("--kv", kvArgument(profile.kv));
  config.args = [...args, ...profile.extraArgs];
  config.model_name = profile.id;
  config.port = profile.port;
  config.gpu = profile.gpu;
  config.env = { ...config.env, ...profile.environment };
  config.host = "127.0.0.1";
  config.open_browser = false;
  return config;
}
