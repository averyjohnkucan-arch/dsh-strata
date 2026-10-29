import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/** Read the engine's reported rates from its latest completed request, not the tuner's aggregate score. */
export function tuningSample(text) {
  let sample = null;
  const rates =
    /^strata serve:.*?\b(\d+) read in [\d.]+ ms \(([\d.]+) tok\/s\),\s*\d+ generated in [\d.]+ ms \(([\d.]+) tok\/s\)/gm;
  for (const match of text.matchAll(rates)) {
    const prefill = Number(match[2]),
      decode = Number(match[3]);
    sample = {
      prefillTokS:
        Number(match[1]) > 0 && Number.isFinite(prefill) && prefill > 0
          ? prefill
          : null,
      decodeTokS: Number.isFinite(decode) && decode > 0 ? decode : null,
    };
  }
  return sample;
}

async function trialLogs(directory) {
  const files = await Promise.all(
    (await readdir(directory))
      .filter((name) => /^engine-\d+\.log$/.test(name))
      .map(async (name) => {
        const path = join(directory, name);
        try {
          const info = await stat(path, { bigint: true });
          return {
            name,
            path,
            trial: Number(name.match(/\d+/)[0]),
            revision: [info.ino, info.size, info.mtimeNs, info.ctimeNs].join(
              ":",
            ),
          };
        } catch (error) {
          if (error.code === "ENOENT") return null;
          throw error;
        }
      }),
  );
  return files.filter(Boolean);
}

/** Remember earlier logs without depending on wall-clock or filesystem timestamp precision. */
export async function tuningLogSnapshot(directory) {
  return Object.fromEntries(
    (await trialLogs(directory)).map((file) => [file.name, file.revision]),
  );
}

/** Poll only this run's newest trial; read a bounded tail even when native logs grow large. */
export async function readTuningSample(directory, previousLogs = {}) {
  const empty = { prefillTokS: null, decodeTokS: null };
  const latest = (await trialLogs(directory))
    .filter((file) => file.revision !== previousLogs[file.name])
    .sort((a, b) => b.trial - a.trial)[0];
  if (!latest) return empty;
  const file = await open(latest.path, "r");
  try {
    const { size } = await file.stat();
    const buffer = Buffer.alloc(Math.min(size, 64 * 1024));
    const { bytesRead } = await file.read(
      buffer,
      0,
      buffer.length,
      size - buffer.length,
    );
    return (
      tuningSample(buffer.subarray(0, bytesRead).toString("utf8")) || empty
    );
  } finally {
    await file.close();
  }
}

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
