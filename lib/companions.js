import { dirname } from "node:path";

/** Only an unambiguous projector in this model's directory tree is attached automatically. */
export function findProjector(model, inventory) {
  const folders = new Set(model.files.map((file) => dirname(file.path)));
  const candidates = (inventory?.components || []).filter(
    (component) =>
      component.role === "Vision" &&
      component.status === "complete" &&
      component.files.some((file) =>
        [...folders].some(
          (folder) =>
            dirname(file.path) === folder ||
            dirname(file.path).startsWith(folder + "/"),
        ),
      ),
  );
  return candidates.length === 1 ? candidates[0].files[0].path : "";
}
