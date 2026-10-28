import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

/** A prepared Flash-Next draft has a specific layout; GGUF drafts are not interchangeable. */
export async function inspectMtpRuntime(path) {
  if (!isAbsolute(path))
    throw new Error("Choose an absolute MTP runtime folder");
  try {
    const [experts, dense, vocab, index] = await Promise.all([
      stat(join(path, "experts.bin")),
      stat(join(path, "dense.bin")),
      stat(join(path, "draft_vocab.bin")),
      readFile(join(path, "dense.txt"), "utf8"),
    ]);
    if (
      experts.size !== 707788800 ||
      !dense.isFile() ||
      !vocab.isFile() ||
      !index.startsWith("fc_embedding.weight q8_0 2560 2560 ")
    )
      throw new Error("Invalid layout");
  } catch {
    throw new Error(
      "Choose a prepared Flash-Next MTP folder containing experts.bin, dense.bin, dense.txt and draft_vocab.bin",
    );
  }
  return path;
}
