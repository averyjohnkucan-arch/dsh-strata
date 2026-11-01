import { dirname, resolve, sep } from "node:path";

/** Move only plugin-managed runtime paths; keep measured flags and model assets. */
export function migrateManagedRuntime(profile, runtime, runtimeRoot) {
  const config = profile.config;
  if (!config || !runtime.executable || !runtime.controlDir) return false;
  if (
    ["executable", "controlDir", "python"].some((key) => profile.runtime?.[key])
  )
    return false;
  const oldRoot = dirname(dirname(resolve(config.exe || "/")));
  if (!oldRoot.startsWith(resolve(runtimeRoot) + sep)) return false;
  if (config.exe === runtime.executable && config.cwd === runtime.controlDir)
    return false;
  const nextRoot = dirname(dirname(resolve(runtime.executable)));
  profile.config = {
    ...config,
    exe: runtime.executable,
    cwd: runtime.controlDir,
    ...(config.lib_dirs
      ? {
          lib_dirs: config.lib_dirs.map((path) =>
            resolve(path).startsWith(oldRoot + sep)
              ? nextRoot + resolve(path).slice(oldRoot.length)
              : path,
          ),
        }
      : {}),
  };
  return true;
}

/** Resolve runtime overrides per model; stock models keep the global runtime. */
export function modelRuntime(settings, profile) {
  const overrides = profile?.runtime || {};
  const types =
    profile?.model?.files?.flatMap((file) =>
      Object.keys(file.encodings || {}).map(Number),
    ) || [];
  const embeddedFork =
    !overrides.executable && types.some((type) => type >= 147 && type <= 149)
      ? settings.fork
      : undefined;
  const runtime = {
    ...settings,
    ...embeddedFork,
    tqp: embeddedFork?.tqp === true || overrides.tqp === true,
  };
  for (const key of ["controlDir", "python", "executable"])
    if (overrides[key]) runtime[key] = overrides[key];
  return runtime;
}

/** Only a declared TQP fork can clear this specific stock encoding restriction. */
export function modelSetupIssue(model, runtime) {
  // Older inventories cached the importer restriction before native setup was wired.
  if (model?.architecture === "deepseek41") return null;
  const types = new Set(
    model?.files?.flatMap((file) =>
      Object.keys(file.encodings || {}).map(Number),
    ) || [],
  );
  const known = (type) =>
    (type >= 0 && type <= 42) || (type >= 143 && type <= 149);
  if (
    runtime.tqp &&
    model?.architecture === "qwen4exp" &&
    [...types].some((type) => type >= 147 && type <= 149) &&
    [...types].every(known)
  )
    return null;
  return model?.setupIssue || null;
}
