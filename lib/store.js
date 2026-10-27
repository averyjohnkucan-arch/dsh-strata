import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** Publish the whole registry atomically; failed writes leave the previous file intact. */
export class Store {
  constructor(root) {
    this.root = root;
    this.tail = Promise.resolve();
  }
  async read(name, fallback) {
    try {
      return JSON.parse(
        await readFile(join(this.root, name + ".json"), "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  }
  write(name, value) {
    const snapshot = JSON.stringify(value, null, 2) + "\n";
    this.tail = this.tail
      .catch(() => {})
      .then(async () => {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const temp = join(this.root, name + "." + randomUUID() + ".tmp");
        try {
          await writeFile(temp, snapshot, { mode: 0o600, flag: "wx" });
          await rename(temp, join(this.root, name + ".json"));
        } finally {
          await rm(temp, { force: true });
        }
      });
    return this.tail;
  }
}
