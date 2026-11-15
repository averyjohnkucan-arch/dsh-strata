import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  availableCpuIds,
  cpuBudget,
  cpuLaunch,
  reservedCpuSet,
} from "../lib/cpu-set.js";
import { StrataService } from "../lib/service.js";

test("reserving two of 24 CPUs allows 22, including non-contiguous affinity", () => {
  const ids = Array.from({ length: 24 }, (_, index) => index);
  assert.deepEqual(cpuBudget(2, ids), {
    available: 24,
    coresKeptFree: 2,
    limit: 22,
    cpuSet: "0-21",
  });
  assert.equal(reservedCpuSet(undefined, 2, [2, 4, 6, 8]), "2,4");
  assert.equal(reservedCpuSet("0-7", 2, ids), "0-7");
  assert.equal(reservedCpuSet("20-23", 2, ids), "20-21");
  assert.throws(() => reservedCpuSet("22-23", 2, ids), /does not overlap/);
  for (const value of [-1, 24, 25, 1.5, "2", NaN, null])
    assert.throws(() => cpuBudget(value, ids));
  assert.equal(reservedCpuSet(undefined, 0, ids), "");
});

test("CPU settings persist across activation without discarding runtime settings or prepared profiles", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-cpu-settings-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StrataService({ dataDir: root });
  await service.init();
  t.after(() => service.dispose());
  const reserve = availableCpuIds().length > 2 ? 2 : 0;
  const runtime = service.settings.controlDir;
  await service.action("cpu-settings", { coresKeptFree: reserve });
  assert.equal(service.settings.controlDir, runtime);
  const next = new StrataService({ dataDir: root });
  await next.init();
  t.after(() => next.dispose());
  assert.equal(next.state().cpuBudget.coresKeptFree, reserve);
  assert.equal(
    next.state().cpuBudget.limit,
    availableCpuIds().length - reserve,
  );
  assert.equal(next.settings.controlDir, runtime);
  const command = next.cpuCommand("python3", ["serve.py"]);
  assert.equal(command.executable, reserve ? "taskset" : "python3");
  await assert.rejects(
    next.action("cpu-settings", { coresKeptFree: availableCpuIds().length }),
  );
  assert.equal(next.settings.coresKeptFree, reserve);
});

test(
  "the server and its child process both inherit the reduced CPU set",
  { skip: process.platform !== "linux" },
  () => {
    const ids = availableCpuIds();
    if (ids.length < 2) return;
    const selected = reservedCpuSet(undefined, 1, ids);
    const command = cpuLaunch(
      process.execPath,
      [
        "-e",
        `
    const fs = require('node:fs');
    const cp = require('node:child_process');
    const own = fs.readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\\s*(.+)$/m)[1];
    const child = cp.execFileSync(process.execPath, ['-e', "process.stdout.write(require('fs').readFileSync('/proc/self/status','utf8'))"], {encoding:'utf8'}).match(/^Cpus_allowed_list:\\s*(.+)$/m)[1];
    process.stdout.write(JSON.stringify({own,child}));
  `,
      ],
      selected,
    );
    const result = JSON.parse(
      execFileSync(command.executable, command.args, { encoding: "utf8" }),
    );
    assert.equal(result.own, selected);
    assert.equal(result.child, selected);
  },
);
