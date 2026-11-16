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

// DeepSeek has native low/high/max budgets; Qwen's medium/xhigh labels differ.
function isDeepSeek(profile) {
  return [profile.model?.architecture, profile.config?.arch].some((arch) =>
    ["deepseek4", "deepseek41"].includes(arch),
  );
}

export function isQwenProfile(profile) {
  return (
    /^qwen/i.test(profile.model?.architecture || "") ||
    /qwen/i.test([profile.name, profile.model?.name].join(" "))
  );
}

export function thinkingInfo(profile) {
  if (isDeepSeek(profile))
    return {
      efforts: [
        { id: "none", name: "Off", description: "Disable thinking" },
        {
          id: "low",
          name: "Low",
          description: "Native DeepSeek effort: 50/100",
        },
        {
          id: "high",
          name: "High",
          description: "Native DeepSeek effort: 75/100",
        },
        {
          id: "max",
          name: "Max",
          description: "Native DeepSeek effort: 100/100",
        },
      ],
      defaultEffort: "high",
    };
  const efforts = [
    { id: "off", name: "Off", description: "Disable thinking" },
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium" },
    { id: "xhigh", name: "Xhigh", description: "Native xhigh thinking" },
  ];
  if (supportsProjection(profile))
    efforts.push({
      id: "uncensored",
      name: "Uncensored",
      description: "Medium with the Flash Next refusal-direction projection",
    });
  return { efforts, defaultEffort: isQwenProfile(profile) ? "medium" : "high" };
}

export function thinkingPreset(
  profile,
  effort = thinkingInfo(profile).defaultEffort,
) {
  if (isDeepSeek(profile)) {
    if (effort === "off") effort = "none";
    // Accept selections saved before DeepSeek received its own native picker.
    if (effort === "medium") effort = "high";
    if (effort === "xhigh") effort = "max";
    if (!thinkingInfo(profile).efforts.some((choice) => choice.id === effort))
      throw new Error("Unsupported DeepSeek thinking preset: " + effort);
    return { effort, projection: false };
  }
  // Preserve old saved High choices while exposing the native Xhigh label.
  if (effort === "high") effort = "xhigh";
  if (!thinkingInfo(profile).efforts.some((choice) => choice.id === effort))
    throw new Error("Unsupported Strata thinking preset: " + effort);
  return {
    effort:
      effort === "off"
        ? "none"
        : effort === "low" || effort === "medium" || effort === "uncensored"
          ? effort === "uncensored"
            ? "medium"
            : effort
          : "xhigh",
    projection: effort === "uncensored",
  };
}

/** Preserve conversation text; projection is an engine control. */
export function projectionContext(_profile, system, _projection) {
  // Steering is an engine control; never inject a runtime notice into prompts.
  return system;
}
