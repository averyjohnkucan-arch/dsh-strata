/** Strata reports tuning failures on stdout as JSON, including when its process exits nonzero. */
export function tuningEnvelope(stdout = "") {
  for (const line of stdout.split("\n").reverse()) {
    try {
      const value = JSON.parse(line);
      if (value.schema_version === 1) return value;
    } catch {
      /* Progress lines need not be JSON. */
    }
  }
  return null;
}

export function tuningFailure(error) {
  const envelope = tuningEnvelope(error.stdout);
  const message = envelope?.error?.message || envelope?.result?.message;
  return message ? new Error(message, { cause: error }) : error;
}
