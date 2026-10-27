import { actionPath } from "../lib/http.js";

export async function request(action, payload = {}) {
  const readingFiles = ["browse", "projector", "capabilities"].includes(action);
  let response;
  try {
    response = await fetch(actionPath, {
      credentials: "same-origin",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
  if (response.status === 401 || response.status === 403)
    throw new Error(
      "DSH needs its owner session. Reopen DSH using its launch link, then reload this page.",
    );
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(data.error || response.statusText);
  return data.result;
}

export const size = (bytes) =>
  bytes >= 1073741824
    ? (bytes / 1073741824).toFixed(2) + " GiB"
    : (bytes / 1048576).toFixed(1) + " MiB";
