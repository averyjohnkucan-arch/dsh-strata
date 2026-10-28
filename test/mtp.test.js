import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectMtpRuntime } from "../lib/mtp.js";
import { StrataService } from "../lib/service.js";

test("a single prepared Flash-Next MTP runtime is attached during import", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strata-mtp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = await open(join(root, "experts.bin"), "w");
  await file.truncate(707788800);
  await file.close();
  await writeFile(join(root, "dense.bin"), "dense");
  await writeFile(join(root, "draft_vocab.bin"), "vocab");
  await writeFile(
    join(root, "dense.txt"),
    "fc_embedding.weight q8_0 2560 2560 0 6963200\n",
  );
  assert.equal(await inspectMtpRuntime(root), root);
  const service = new StrataService({ dataDir: join(root, "data") });
  await service.init();
  service.inventory = {
    mtpRuntimes: [root],
    components: [],
    models: [
      {
        id: "one",
        name: "Flash Next",
        architecture: "qwen4exp",
        status: "complete",
        files: [
          {
            path: join(root, "model.gguf"),
            metadata: {
              "qwen4exp.embedding_length": 2560,
              "qwen4exp.expert_count": 512,
              "general.basename": "Qwen3.8-Flash-Next",
            },
          },
        ],
      },
    ],
  };
  await service.addModels(["one"]);
  assert.equal(service.profiles[0].mtp, root);
  const id = service.profiles[0].id;
  assert.deepEqual(await service.mtpStatus(id), {
    kind: "selected",
    path: root,
  });
  service.profiles[0].mtp = "auto";
  assert.deepEqual(await service.mtpStatus(id), {
    kind: "download",
    candidates: [root],
  });
  service.profiles[0].mtp = root;
  await rm(join(root, "dense.txt"));
  assert.deepEqual(await service.mtpStatus(id), {
    kind: "missing",
    path: root,
  });
  await assert.rejects(
    () => inspectMtpRuntime(root),
    /prepared Flash-Next MTP folder/,
  );
  await service.dispose();
});
