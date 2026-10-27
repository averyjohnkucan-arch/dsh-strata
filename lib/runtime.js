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
