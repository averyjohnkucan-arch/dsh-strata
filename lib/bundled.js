import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import engine from "../engine.json" with { type: "json" };

// UI/provider updates reuse the same validated native runtime until its ABI changes.
export const runtimeVersion = engine.runtimeVersion;

/** A release package carries the same runtime tree that source installs acquire from this repo. */
export async function bundledRuntime(root, packageRoot) {
  try {
    const manifest = JSON.parse(
      await readFile(join(root, "manifest.json"), "utf8"),
    );
    if (
      (manifest.runtimeVersion || manifest.pluginVersion) !== runtimeVersion ||
      manifest.platform !== process.platform ||
      manifest.arch !== process.arch
    )
      throw new Error(
        "The packaged Strata runtime does not match this platform",
      );
    const controlDir = join(root, "control"),
      python = join(controlDir, "python/bin/python3"),
      executable = join(root, "engine/strata");
    await Promise.all([
      access(python),
      access(executable),
      access(join(controlDir, "strata.py")),
    ]);
    const settings = {
      controlDir,
      python,
      executable,
      bundledVersion: manifest.pluginVersion,
      release: manifest.strataRelease,
      helper: join(packageRoot, "vendor/gguf-py"),
    };
    if (manifest.fork)
      settings.fork = {
        controlDir: join(packageRoot, "vendor/gyro-l-control"),
        python,
        executable: join(root, "gyro-l/strata"),
        tqp: true,
      };
    return settings;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
