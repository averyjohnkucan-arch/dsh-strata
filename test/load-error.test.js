import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gpuSnapshot, loadError } from "../lib/load-error.js";
import { StrataService } from "../lib/service.js";

const profile = { id: "s", name: "Gyro S", gpu: 0, context: 262144, port: 0 };
test("GPU diagnostics select the configured device and tolerate unavailable telemetry", async () => {
  const snapshot = await gpuSnapshot(1, async (_command, args) => ({
    stdout: args[0].startsWith("--query-gpu=")
      ? "0, GPU-A, 24000, 20000\n1, GPU-B, 24000, 5000\n"
      : "GPU-A, 11, /path/other, 4000\nGPU-B, 22, /private/ninfer, 18000\n",
  }));
  assert.deepEqual(snapshot, {
    totalMiB: 24000,
    freeMiB: 5000,
    processes: [{ pid: 22, name: "ninfer", memoryMiB: 18000 }],
  });
  assert.equal(
    await gpuSnapshot(0, async () => {
      throw new Error("No nvidia-smi");
    }),
    null,
  );
});
test("allocation failures explain competition without dumping a traceback or blaming mlock", () => {
  const error = loadError(
    "Traceback\nPLE table mlock failed\nstrata generate: session state allocation failed",
    profile,
    "/models/s/startup.log",
    {
      totalMiB: 24000,
      freeMiB: 5000,
      processes: [{ pid: 22, name: "ninfer", memoryMiB: 18000 }],
    },
  );
  assert.match(error.message, /GPU session memory.*262,144/);
  assert.match(error.message, /ninfer, PID 22/);
  assert.match(error.message, /shared model scheduler/);
  assert.doesNotMatch(error.message, /Traceback|mlock/);
  assert.ok(error.message.length < 800);
  assert.match(
    loadError("CUDA out of memory", profile, "/log").message,
    /smaller context/,
  );
});
test("startup failures retain private diagnostics, remove state and permit retries", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-load-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  service.profiles = [profile];
  service.settings = { controlDir: root, python: "python3" };
  service.prepare = async () => profile;
  service.launchConfig = () => ({ exe: "/bin/true", args: [] });
  await writeFile(
    join(root, "strata.py"),
    'import sys\nprint("Traceback fixture\\nstrata generate: session state allocation failed", file=sys.stderr)\nsys.exit(1)\n',
  );
  for (let i = 0; i < 2; i++) {
    await assert.rejects(
      service.acquire("s"),
      /could not allocate GPU session memory/,
    );
    assert.equal(service.answering, 0);
    assert.equal(service.servers.size, 0);
  }
  const path = join(root, "models", "s", "startup.log");
  assert.match(await readFile(path, "utf8"), /Traceback fixture/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await service.dispose();
});
