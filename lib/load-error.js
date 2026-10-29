import { basename } from "node:path";
import { execute } from "./process.js";

/** Best-effort diagnostics only: GPU telemetry never decides how Strata sizes a model. */
export async function gpuSnapshot(gpu, runner = execute) {
  try {
    const { stdout } = await runner(
      "nvidia-smi",
      [
        "--query-gpu=index,uuid,memory.total,memory.free",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 2000 },
    );
    const fields = stdout
      .split("\n")
      .map((line) => line.split(",").map((x) => x.trim()))
      .find((row) => row[0] === String(gpu));
    if (!fields || !Number.isFinite(Number(fields[2]))) return null;
    const { stdout: apps } = await runner(
      "nvidia-smi",
      [
        "--query-compute-apps=gpu_uuid,pid,process_name,used_gpu_memory",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 2000 },
    );
    return {
      totalMiB: Number(fields[2]),
      freeMiB: Number(fields[3]),
      processes: apps
        .split("\n")
        .map((line) => line.split(",").map((x) => x.trim()))
        .filter((row) => row[0] === fields[1] && Number(row.at(-1)) > 0)
        .map((row) => ({
          pid: Number(row[1]),
          name: basename(row.slice(2, -1).join(",")),
          memoryMiB: Number(row.at(-1)),
        })),
    };
  } catch {
    return null; // CUDA hosts without nvidia-smi still load normally.
  }
}

/** Keep native diagnostics on disk, with one actionable message in the chat. */
export function loadError(log, profile, path, gpu, timedOut = false) {
  const allocation =
    /session state allocation failed|out of memory|cudaErrorMemoryAllocation/i.test(
      log,
    );
  let reason;
  if (allocation) {
    reason = `Strata could not allocate GPU session memory for ${profile.name} (${profile.context.toLocaleString("en-US")} context).`;
    if (gpu?.processes.length) {
      reason += ` Before loading, GPU ${profile.gpu} had ${(gpu.freeMiB / 1024).toFixed(1)} GiB free of ${(gpu.totalMiB / 1024).toFixed(1)} GiB; other processes were using it (${gpu.processes.map((p) => `${p.name}, PID ${p.pid}, ${(p.memoryMiB / 1024).toFixed(1)} GiB`).join("; ")}). Finish the other answer and unload its model, or enable the shared model scheduler for cooperating providers.`;
    } else
      reason +=
        " Unload other GPU models and retry. If it still fails, choose a smaller context or a supported lower-precision KV format.";
  } else if (/failed to initialize CUDA|no CUDA-capable device/i.test(log)) {
    reason =
      "Strata could not initialize CUDA. Check that the GPU is available to DSH and the NVIDIA driver is working.";
  } else {
    const detail = log
      .split("\n")
      .findLast((line) => /error|failed|exception/i.test(line));
    reason = timedOut
      ? "Strata model loading timed out."
      : "Strata stopped before the model was ready.";
    if (detail) reason += " " + detail.trim().slice(0, 300);
  }
  return new Error(reason + ` Details: ${path}`);
}
