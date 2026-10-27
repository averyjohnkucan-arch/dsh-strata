import { createHash } from "node:crypto";
import { mkdir, readdir, lstat, rm, utimes } from "node:fs/promises";
import { join } from "node:path";

const managedFile = /^[a-f0-9]{64}-[a-f0-9]{64}\.state$/;
const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

/** An LRU directory of opaque Strata session files. Strata owns serialization and validation. */
export class Checkpoints {
  constructor(root, budgetBytes = 16 * 1024 ** 3) {
    this.root = root;
    this.budgetBytes = budgetBytes;
  }
  async directory(model) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(model))
      throw new Error("Invalid checkpoint model ID");
    const path = join(this.root, model);
    await mkdir(path, { recursive: true, mode: 0o700 });
    return path;
  }
  filename(session, signature) {
    return digest(session) + "-" + digest(signature) + ".state";
  }
  async existing(model, filename) {
    if (!managedFile.test(filename))
      throw new Error("Invalid checkpoint filename");
    const path = join(await this.directory(model), filename);
    try {
      const stat = await lstat(path);
      return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0
        ? path
        : null;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async touch(model, filename) {
    const path = await this.existing(model, filename);
    if (path) {
      const now = new Date();
      await utimes(path, now, now);
    }
  }
  async discard(model, filename) {
    if (managedFile.test(filename))
      await rm(join(await this.directory(model), filename), { force: true });
  }
  async prune(model) {
    const directory = await this.directory(model),
      files = [];
    for (const name of await readdir(directory)) {
      if (!managedFile.test(name)) continue;
      const path = join(directory, name);
      try {
        const stat = await lstat(path);
        if (stat.isFile() && !stat.isSymbolicLink())
          files.push({ path, bytes: stat.size, touched: stat.mtimeMs });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    // A single oversized snapshot cannot fit the budget; keep the usable older ones.
    for (let i = files.length - 1; i >= 0; i--)
      if (files[i].bytes > this.budgetBytes) {
        await rm(files[i].path, { force: true });
        files.splice(i, 1);
      }
    files.sort((a, b) => a.touched - b.touched || a.path.localeCompare(b.path));
    let bytes = files.reduce((sum, file) => sum + file.bytes, 0),
      evicted = 0;
    for (const file of files) {
      if (bytes <= this.budgetBytes) break;
      await rm(file.path, { force: true });
      bytes -= file.bytes;
      evicted++;
    }
    return { bytes, evicted };
  }
}
