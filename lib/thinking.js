/** The bundled vector targets original Flash-Next, not Swift or another architecture. */
export function supportsProjection(profile) {
  const model = profile.model || {};
  const metadata =
    model.files?.find((file) => file.index === 1)?.metadata || {};
  const name = [
    model.name,
    metadata["general.name"],
    metadata["general.basename"],
  ].join(" ");
  return (
    model.architecture === "qwen4exp" &&
    metadata["qwen4exp.block_count"] === 48 &&
    /Qwen3\.8[- ]Flash[- ]Next/i.test(name) &&
    !/swift/i.test(name) &&
    (metadata["qwen4exp.embedding_length"] === undefined ||
      metadata["qwen4exp.embedding_length"] === 2560)
  );
}

export function thinkingInfo(profile) {
  const efforts = [
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium" },
    { id: "high", name: "High", description: "Strata xhigh thinking" },
  ];
  if (supportsProjection(profile))
    efforts.push({
      id: "uncensored",
      name: "Uncensored",
      description:
        "Xhigh thinking with the experimental refusal-direction projection; not a guarantee of unrestricted answers",
    });
  return { efforts, defaultEffort: "high" };
}

export function thinkingPreset(profile, effort = "high") {
  // Keep old saved xhigh selections readable, while the picker uses the requested High label.
  if (effort === "xhigh") effort = "high";
  if (!thinkingInfo(profile).efforts.some((choice) => choice.id === effort))
    throw new Error("Unsupported Strata thinking preset: " + effort);
  return {
    effort: effort === "low" || effort === "medium" ? effort : "xhigh",
    projection: effort === "uncensored",
  };
}
