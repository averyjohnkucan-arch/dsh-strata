export async function request(action, payload = {}) {
  const connection = window.__DSH_STRATA__;
  if (!connection)
    throw new Error("Restart DSH and reload this page to connect Strata");
  const readingFiles = ["browse", "projector", "capabilities"].includes(action);
  let response;
  try {
    response = await fetch(connection.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + connection.token,
      },
      body: JSON.stringify({ action, payload }),
      signal: readingFiles ? AbortSignal.timeout(30000) : undefined,
    });
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new Error(
        "DSH took too long to read that folder or file. Try another folder or check the model drive.",
      );
    throw error;
  }
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(data.error || response.statusText);
  return data.result;
}

export const size = (bytes) =>
  bytes >= 1073741824
    ? (bytes / 1073741824).toFixed(2) + " GiB"
    : (bytes / 1048576).toFixed(1) + " MiB";
