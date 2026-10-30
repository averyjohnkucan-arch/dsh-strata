/** CPU affinity belongs to the whole server tree, including its CUDA helpers and vision encoder. */
export function validateCpuSet(value) {
  if (value === undefined || value === "") return "";
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value)
  )
    throw new Error(
      "CPU set must contain core numbers or ranges, such as 0-21",
    );
  const seen = new Set();
  for (const range of value.split(",")) {
    const [start, end = start] = range.split("-").map(Number);
    if (start > end || end > 4095) throw new Error("Invalid CPU range");
    for (let cpu = start; cpu <= end; cpu++) {
      if (seen.has(cpu)) throw new Error("Duplicate CPU in set");
      seen.add(cpu);
    }
  }
  return value;
}

export function cpuLaunch(
  executable,
  args,
  cpuSet,
  platform = process.platform,
) {
  const cores = validateCpuSet(cpuSet);
  if (!cores) return { executable, args };
  if (platform !== "linux")
    throw new Error(
      "This tuned CPU set requires Linux; clear cpuSet on this system",
    );
  return {
    executable: "taskset",
    args: ["--cpu-list", cores, executable, ...args],
  };
}
