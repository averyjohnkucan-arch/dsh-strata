/** Labels match Strata's K/V order. Legacy names remain readable in saved profiles. */
export const kvChoices = Object.freeze([
  "FP16/FP16",
  "FP16/Q8",
  "Q8/Q8",
  "Q8/Q5",
  "Q5/Q5",
  "Q5/Q4",
  "Q4/Q4",
]);
export const contextStep = 32768;
export function kvLabel(value) {
  return (
    { fp16: "FP16/FP16", int8: "Q8/Q8", q4_0: "Q4/Q4", k8v4: "Q8/Q4" }[value] ||
    value
  );
}
export function kvArgument(value) {
  return (
    { "FP16/FP16": "fp16", "Q8/Q8": "int8", "Q4/Q4": "q4_0", "Q8/Q4": "k8v4" }[
      value
    ] || value
  );
}
export function supportedKv(help) {
  const declarations = [...help.matchAll(/--kv(?:\s+|=)([^\n]+)/g)]
    .map((match) => match[1])
    .join(" ")
    .toUpperCase();
  return kvChoices.filter(
    (value) =>
      declarations.includes(value) ||
      new RegExp("\\b" + kvArgument(value).toUpperCase() + "\\b").test(
        declarations,
      ),
  );
}

export function contextChoices(profile) {
  const metadata =
    profile.model?.files?.find((file) => file.index === 1)?.metadata || {};
  const trained =
    Number(metadata[profile.model?.architecture + ".context_length"]) ||
    contextStep;
  const limit = Math.min(4194304, Math.max(4096, trained));
  if (limit < contextStep) return [limit];
  return Array.from(
    { length: Math.floor(limit / contextStep) },
    (_, index) => (index + 1) * contextStep,
  );
}
