/** Control vectors change model activations; they are never independent language models. */
export function isControlVector(model) {
  return (
    model?.architecture === "controlvector" ||
    model?.files?.some(
      (file) =>
        file.architecture === "controlvector" ||
        file.metadata?.["general.architecture"] === "controlvector",
    )
  );
}

export function repairInventory(inventory, extra = []) {
  const misplaced = (inventory?.models || []).filter(isControlVector);
  if (!misplaced.length && !extra.length) return inventory;
  const components = new Map(
    (inventory?.components || []).map((item) => [item.id, item]),
  );
  for (const model of [...misplaced, ...extra])
    components.set(model.id, {
      ...model,
      role: "Control vector",
      files: (model.files || []).map((file) => ({
        ...file,
        role: "Control vector",
      })),
    });
  return {
    root: "",
    filesScanned: extra.reduce(
      (sum, item) => sum + (item.files?.length || 0),
      0,
    ),
    errors: [],
    ...inventory,
    models: (inventory?.models || []).filter(
      (model) => !isControlVector(model),
    ),
    components: [...components.values()],
  };
}
