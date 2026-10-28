import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrataService } from "../lib/service.js";

test("source activation installs once, and a failed download can be retried", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-auto-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let attempts = 0;
  const service = new StrataService(
    { dataDir: root },
    () => {},
    async (_cmd, args) => {
      attempts++;
      if (attempts === 1) throw new Error("Download failed");
      const runtime = args.at(-1);
      for (const file of [
        "control/python/bin/python3",
        "control/strata.py",
        "engine/strata",
      ]) {
        const path = join(runtime, file);
        await mkdir(join(path, ".."), { recursive: true });
        await writeFile(path, "");
      }
      await writeFile(
        join(runtime, "manifest.json"),
        JSON.stringify({
          runtimeVersion: "0.5.0",
          pluginVersion: "0.5.0",
          platform: process.platform,
          arch: process.arch,
        }),
      );
      return { stdout: `DSH_RESULT=${JSON.stringify({ root: runtime })}\n` };
    },
  );
  await service.init();
  const job = service.ensureRuntime();
  await service.jobs.items.get(job.id).promise;
  assert.equal(service.jobs.list()[0].status, "failed");
  assert.match(service.jobs.list()[0].error, /Download failed/);
  const retry = await service.action("install");
  await service.jobs.items.get(retry.id).promise;
  assert.equal(service.jobs.list()[1].status, "complete");
  assert.ok(service.settings.executable);
  assert.equal(service.ensureRuntime(), undefined);
  assert.equal(attempts, 2);
  await service.dispose();
});
