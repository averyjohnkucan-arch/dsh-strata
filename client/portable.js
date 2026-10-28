/** Only the small JSON recipe is downloaded; weights remain on the host. */
export function downloadConfig(config) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(config, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    config.name.replace(/[^a-zA-Z0-9._-]/g, "_") + ".dsh-model.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
