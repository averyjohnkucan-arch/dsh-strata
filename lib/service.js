import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  access,
  mkdir,
  readdir,
  readFile,
  writeFile,
  stat,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Checkpoints } from "./checkpoints.js";
import { Jobs } from "./jobs.js";
import { bundledRuntime, runtimeVersion, projectionPath } from "./bundled.js";
import { tuningEnvelope, tuningFailure } from "./tuning.js";
import { modelRuntime, modelSetupIssue } from "./runtime.js";
import {
  kvLabel,
  kvArgument,
  supportedKv,
  supportsFlashMtp,
} from "./choices.js";
import { supportsProjection } from "./thinking.js";
import { isControlVector, repairInventory } from "./inventory.js";
import { findProjector } from "./companions.js";
import { inspectMtpRuntime } from "./mtp.js";
import { Store } from "./store.js";
import { createProfile, runConfig, validateProfile } from "./profiles.js";
import { execute, receipt, terminate } from "./process.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

/** Workflow coordinator. File inspection, Strata operations and DSH presentation stay separate. */
export class StrataService {
  constructor(config = {}, changed = () => {}, runner = execute) {
    this.root = resolve(
      config.dataDir ||
        join(process.env.DSH_HOME || join(homedir(), ".dsh"), "dsh-strata-v2"),
    );
    this.store = new Store(this.root);
    this.checkpoints = new Checkpoints(join(this.root, "cache", "checkpoints"));
    this.cacheNotice = "";
    this.changed = changed;
    this.execute = runner;
    this.jobs = new Jobs(changed);
    this.servers = new Map();
    this.requestTail = Promise.resolve();
    this.loadTail = Promise.resolve();
    this.shutdown = new AbortController();
    this.answering = 0;
  }
  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    this.profiles = await this.store.read("profiles", []);
    this.settings = await this.store.read("settings", {
      controlDir: "",
      python: "python3",
      executable: "",
    });
    this.inventory = await this.store.read("inventory", null);
    const misplaced = this.profiles.filter((profile) =>
      isControlVector(profile.model),
    );
    if (misplaced.length) {
      // Preserve accidentally imported component profiles before removing their model routes.
      const archived = await this.store.read("component-profiles", []);
      await this.store.write("component-profiles", [
        ...new Map([...archived, ...misplaced].map((p) => [p.id, p])).values(),
      ]);
      this.profiles = this.profiles.filter(
        (profile) => !isControlVector(profile.model),
      );
      await this.store.write("profiles", this.profiles);
    }
    const repaired = repairInventory(
      this.inventory,
      misplaced.map((profile) => profile.model),
    );
    if (repaired !== this.inventory) {
      this.inventory = repaired;
      await this.store.write("inventory", repaired);
    }
    await mkdir(join(this.root, "cache", "tmp"), {
      recursive: true,
      mode: 0o700,
    });
    const bundled =
      (await bundledRuntime(join(packageRoot, "runtime"), packageRoot)) ||
      (await bundledRuntime(
        join(this.root, "runtime", runtimeVersion),
        packageRoot,
      ));
    this.settings = bundled || {
      controlDir: join(packageRoot, "vendor/strata"),
      python: "python3",
      executable: "",
    };
    let enabledMtp = false;
    for (const profile of this.profiles) {
      if (
        profile.model?.architecture === "qwen35moe" &&
        profile.kv !== "fp32"
      ) {
        profile.kv = "fp32";
        profile.config = null;
        delete profile.tuneReport;
        enabledMtp = true;
      }
      if (!profile.mtp && supportsFlashMtp(profile.model)) {
        profile.mtp = "auto";
        profile.config = null;
        delete profile.tuneReport;
        enabledMtp = true;
      }
      if (
        profile.model?.architecture === "qwen35moe" &&
        profile.model.files?.some((file) => file.tensors?.MTP > 0) &&
        profile.config &&
        !profile.config.args?.includes("--mtp")
      ) {
        profile.config = null;
        delete profile.tuneReport;
        enabledMtp = true;
      }
      const runtime = modelRuntime(this.settings, profile);
      if (
        profile.config &&
        (!runtime.executable ||
          profile.config.exe !== runtime.executable ||
          profile.config.cwd !== runtime.controlDir)
      )
        profile.config = null;
    }
    if (enabledMtp) await this.store.write("profiles", this.profiles);
  }
  profile(id) {
    const profile = this.profiles.find((profile) => profile.id === id);
    if (!profile) throw new Error("Saved model not found");
    return profile;
  }
  async bridge(
    action,
    payload,
    signal,
    report = () => {},
    runtime = this.settings,
  ) {
    if (!runtime.controlDir)
      throw new Error(
        "Install the Strata runtime or select an existing Control directory",
      );
    const result = await this.execute(
      runtime.python,
      [
        "-B",
        join(packageRoot, "python/bridge.py"),
        action,
        "--source",
        runtime.controlDir,
      ],
      {
        input: payload,
        signal,
        onData: report,
        timeout: 3 * 60 * 60 * 1000,
        env: { ...this.environment(), ...payload.profile?.environment },
      },
    );
    return receipt(result.stdout);
  }
  environment() {
    return {
      STRATA_PRESET_DIR: join(this.root, "presets"),
      STRATA_COMPONENTS_DIR: join(this.root, "components"),
      STRATA_SETTINGS_FILE: join(this.root, "strata-settings.json"),
      STRATA_RUNTIME_DIR: join(this.root, "strata-runtime"),
      STRATA_CONTROL_INSTALL: "1",
      STRATA_INSTALL_DIR: join(this.root, "control-work"),
      STRATA_GGUF_PY: join(packageRoot, "vendor/gguf-py"),
      XDG_CACHE_HOME: join(this.root, "cache"),
      HF_HOME: join(this.root, "cache", "huggingface"),
      TMPDIR: join(this.root, "cache", "tmp"),
      CUDA_CACHE_PATH: join(this.root, "cache", "cuda"),
    };
  }
  state() {
    const inventory = this.inventory && {
      ...this.inventory,
      models: this.inventory.models.map((model) => ({
        ...model,
        setupIssue: modelSetupIssue(
          model,
          modelRuntime(
            this.settings,
            this.profiles.find((profile) => profile.model?.id === model.id) || {
              model,
            },
          ),
        ),
      })),
    };
    return {
      settings: this.settings,
      inventory,
      profiles: this.profiles.map((profile) => ({
        ...profile,
        status: this.servers.get(profile.id)?.ready ? "running" : "stopped",
      })),
      jobs: this.jobs.list(),
      cache: {
        diskGiBPerModel: 16,
        policy: "least-recently-used",
        path: join(this.root, "cache"),
        notice: this.cacheNotice,
      },
    };
  }
  async save(profile) {
    if (this.jobs.busy())
      throw new Error(
        "Wait for pending work or cancel it before editing saved models",
      );
    const previous = this.profile(profile.id);
    const next = validateProfile({
      ...profile,
      model: previous.model,
      config: previous.config,
    });
    if (this.profiles.some((p) => p.id !== next.id && p.port === next.port))
      throw new Error("Another saved model uses that port");
    if (next.projector && next.projector !== previous.projector)
      await this.inspectProjector(next.projector);
    if (
      next.mtp &&
      next.mtp !== "auto" &&
      next.mtp !== previous.mtp &&
      next.model.architecture === "qwen4exp"
    )
      await inspectMtpRuntime(next.mtp);
    await this.stop(next.id);
    if (next.config?.env) {
      for (const key of Object.keys(previous.environment || {}))
        delete next.config.env[key];
    }
    // Changing auxiliary inputs requires repacking; ordinary launch controls do not.
    if (
      next.mtp !== previous.mtp ||
      next.projector !== previous.projector ||
      next.vision !== previous.vision ||
      JSON.stringify(next.runtime) !== JSON.stringify(previous.runtime)
    )
      next.config = null;
    if (
      next.context !== previous.context ||
      kvLabel(next.kv) !== kvLabel(previous.kv) ||
      next.mtp !== previous.mtp
    ) {
      delete next.tuneReport;
    }
    this.profiles = this.profiles.map((p) => (p.id === next.id ? next : p));
    await this.store.write("profiles", this.profiles);
    this.changed();
    return next;
  }
  async prepare(id, signal, report) {
    const profile = this.profile(id);
    if (profile.config) return profile;
    let runtime = modelRuntime(this.settings, profile);
    if (!runtime.executable) {
      await this.installRuntime(signal, report);
      runtime = modelRuntime(this.settings, profile);
    }
    const issue = modelSetupIssue(profile.model, runtime);
    if (issue) throw new Error(issue);
    if (profile.projector) {
      let visionExecutable = join(dirname(runtime.executable), "strata-vision");
      try {
        await access(visionExecutable);
      } catch {
        visionExecutable = join(
          dirname(this.settings.executable || runtime.executable),
          "strata-vision",
        );
        await access(visionExecutable);
      }
      runtime = { ...runtime, visionExecutable };
    }
    const choices =
      profile.model.architecture === "qwen35moe"
        ? ["fp32"]
        : supportedKv(await this.engineHelp(runtime, profile));
    if (
      !choices.includes(kvLabel(profile.kv)) &&
      !["fp32", "engine", "k8v4"].includes(profile.kv)
    )
      throw new Error(
        `${kvLabel(profile.kv)} is unavailable in this engine. Select a supported KV pair or update Strata.`,
      );
    const config = await this.bridge(
      "prepare",
      {
        profile: {
          ...profile,
          kvArgument: kvArgument(profile.kv),
          extraArgs: [],
        },
        root: join(this.root, "models", id),
        mtpRoot: join(this.root, "components", "flash-next-mtp"),
        runtime,
      },
      signal,
      report,
      runtime,
    );
    signal?.throwIfAborted();
    // Released runtimes carry CUDA libraries beside the engine. A local fork can reuse them.
    config.lib_dirs = [
      ...new Set(
        [
          dirname(runtime.executable),
          this.settings.executable && dirname(this.settings.executable),
        ].filter(Boolean),
      ),
    ];
    profile.config = config;
    await this.store.write("profiles", this.profiles);
    return profile;
  }
  async tune(id, signal, report) {
    if (this.answering)
      throw new Error("Wait for active answers before tuning");
    await this.stopAll();
    const p = await this.prepare(id, signal, report);
    const runtime = modelRuntime(this.settings, p);
    const directory = join(this.root, "tuning", p.id);
    await mkdir(directory, { recursive: true });
    const config = join(directory, "baseline.json"),
      status = join(directory, "status.json");
    await rm(status, { force: true });
    await writeFile(config, JSON.stringify(this.launchConfig(p)), {
      mode: 0o600,
    });
    const args = [
      "-B",
      join(runtime.controlDir, "strata.py"),
      "tune",
      "auto",
      config,
      "--mode",
      "thorough",
      "--serve-dir",
      runtime.controlDir,
      "--work-dir",
      directory,
      "--status-file",
      status,
      "--output",
      "json",
    ];
    let lastProgress = "";
    const timer = setInterval(async () => {
      try {
        const value = JSON.parse(await readFile(status, "utf8"));
        const progress = value.message || value.text || value.phase || "Tuning";
        if (progress !== lastProgress) {
          lastProgress = progress;
          report(progress);
        }
      } catch {
        /* The tuner atomically replaces this file between trials. */
      }
    }, 1500);
    try {
      const output = await this.execute(runtime.python, args, {
        signal,
        env: this.environment(),
        onData: report,
        timeout: 3 * 60 * 60 * 1000,
      });
      const result = tuningEnvelope(output.stdout);
      if (
        !result?.ok ||
        !["improved", "default_confirmed"].includes(result.result?.outcome) ||
        !result.result?.preset?.id
      )
        throw new Error(
          result?.error?.message ||
            result?.result?.message ||
            "Strata did not confirm and save a usable tuning preset",
        );
      signal?.throwIfAborted();
      p.tuneReport = result.result;
      p.applyPreset = true;
      await this.store.write("profiles", this.profiles);
      return result.result;
    } catch (error) {
      throw tuningFailure(error);
    } finally {
      clearInterval(timer);
    }
  }
  async start(id, signal = this.shutdown.signal) {
    const lease = await this.acquire(id, signal);
    lease.release();
    return lease.state;
  }
  async acquire(id, signal = this.shutdown.signal) {
    if (this.jobs.busy())
      throw new Error("Wait for setup, tuning or cache work to finish");
    this.answering++;
    const previous = this.requestTail;
    let finishTurn, abort, state;
    const turn = new Promise((resolve) => {
      finishTurn = resolve;
    });
    this.requestTail = previous.then(() => turn);
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(signal.reason || new Error("Cancelled"));
      signal.addEventListener("abort", abort, { once: true });
    });
    try {
      signal.throwIfAborted();
      await Promise.race([previous, cancelled]);
      signal.throwIfAborted();
      // The lease covers generation AND native checkpoint IO. A model switch waits for both.
      const loading = this.loadTail
        .catch(() => {})
        .then(() => this.startServer(id, signal));
      this.loadTail = loading.then(
        () => {},
        () => {},
      );
      state = await loading;
      state.active++;
      const service = this;
      let released = false;
      return {
        state,
        release() {
          if (!released) {
            released = true;
            state.active--;
            service.answering--;
            finishTurn();
          }
        },
      };
    } catch (error) {
      this.answering--;
      finishTurn();
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  async startServer(id, signal) {
    signal.throwIfAborted();
    if (this.servers.get(id)?.ready) return this.servers.get(id);
    for (const [other, state] of this.servers)
      if (other !== id) {
        if (state.active)
          throw new Error("Another model is answering; wait before switching");
        await this.stop(other);
      }
    const profile = this.profile(id);
    await this.prepare(id, signal, () => {});
    const url = `http://127.0.0.1:${profile.port}`;
    try {
      const response = await fetch(url + "/v1/models", {
        signal: AbortSignal.timeout(1500),
      });
      if (response)
        throw new Error(
          `Port ${profile.port} is occupied; choose a different port`,
        );
    } catch (error) {
      if (error.name !== "TypeError") throw error;
    }
    const runtime = modelRuntime(this.settings, profile);
    let config = this.launchConfig(profile);
    if (profile.applyPreset)
      config = (
        await this.bridge("preset", { config }, signal, undefined, runtime)
      ).config;
    config.host = "127.0.0.1";
    config.port = profile.port;
    config.model_name = profile.id;
    config.slot_save_path = await this.checkpoints.directory(id);
    await this.checkpoints.prune(id);
    const path = join(this.root, "models", id, "run.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(config), { mode: 0o600 });
    const binaryInfo = await stat(config.exe);
    const child = spawn(
      runtime.python,
      [
        "-B",
        join(runtime.controlDir, "strata.py"),
        "serve",
        "--profile",
        path,
        ...(runtime.bundledVersion ? ["--offline"] : []),
      ],
      {
        cwd: runtime.controlDir,
        env: { ...process.env, ...this.environment(), STRATA_NO_PRESET: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    const state = { child, profile, url, ready: false, active: 0, log: "" };
    state.checkpointSignature = JSON.stringify({
      model: profile.model,
      exe: config.exe,
      args: config.args,
      env: config.env,
      gpu: config.gpu,
      vision: config.vision,
      binary: { size: binaryInfo.size, mtime: binaryInfo.mtimeMs },
    });
    state.checkpointInitialized = false;
    this.servers.set(id, state);
    const log = (chunk) => {
      state.log = (state.log + chunk).slice(-12000);
    };
    child.stdout.on("data", log);
    child.stderr.on("data", log);
    child.on("error", (error) => {
      state.error = error;
    });
    child.on("close", () => {
      if (this.servers.get(id) === state) this.servers.delete(id);
      state.ready = false;
      this.changed();
    });
    try {
      const end = Date.now() + 15 * 60 * 1000;
      while (Date.now() < end) {
        signal.throwIfAborted();
        if (state.error) throw state.error;
        if (child.exitCode !== null || child.signalCode)
          throw new Error("Strata stopped before readiness: " + state.log);
        try {
          const response = await fetch(url + "/v1/models", {
            signal: AbortSignal.timeout(1000),
          });
          if (
            response.ok &&
            (await response.json()).data?.some((model) => model.id === id)
          ) {
            const loaded = await fetch(url + "/load", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
              signal: AbortSignal.any([
                signal,
                AbortSignal.timeout(15 * 60 * 1000),
              ]),
            });
            if (!loaded.ok)
              throw new Error(
                "Strata rejected model loading: " + (await loaded.text()),
              );
            state.ready = true;
            this.changed();
            return state;
          }
        } catch (error) {
          if (error.name !== "TypeError" && error.name !== "TimeoutError")
            throw error;
        }
        await delay(500, undefined, { signal });
      }
      throw new Error("Strata startup timed out: " + state.log);
    } catch (error) {
      await this.stop(id);
      throw error;
    }
  }
  checkpointSession(options) {
    return options.sessionId && !options.purpose
      ? String(options.sessionId)
      : null;
  }
  launchConfig(profile) {
    const config = runConfig(profile);
    if (supportsProjection(profile)) {
      // npm can omit GGUFs from vendored sources. The verified Control runtime carries this asset.
      const vector = projectionPath(
        this.settings?.controlDir || join(packageRoot, "vendor/strata"),
      );
      if (!existsSync(vector))
        throw new Error(
          "The included projection file is missing; reinstall the self-contained plugin. Expected: " +
            vector,
        );
      config.args.push(
        "--control-vector-scaled",
        vector + ":1.0",
        "--control-vector-layer-range",
        "4",
        "44",
        "--cvec-mode",
        "project",
        "--cvec-dir",
        "per-layer",
      );
      // Load once, leave ordinary requests unsteered. The adapter opts in per request.
      config.sampling = {
        ...config.sampling,
        experimental_speed_projection: false,
      };
    }
    return config;
  }
  checkpointSignature(state, options) {
    return (
      state.checkpointSignature +
      (options.projection ? "\nprojection:on" : "\nprojection:off")
    );
  }
  async checkpointRequest(state, action, filename) {
    const response = await fetch(state.url + "/slots/0?action=" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(
        result.error?.message || "Strata checkpoint " + action + " failed",
      );
      error.status = response.status;
      error.kind = result.error?.kind;
      throw error;
    }
    return result;
  }
  async restoreCheckpoint(state, options) {
    const session = this.checkpointSession(options);
    if (!session || state.checkpointInitialized) return;
    state.checkpointInitialized = true;
    const filename = this.checkpoints.filename(
      session,
      this.checkpointSignature(state, options),
    );
    try {
      if (!(await this.checkpoints.existing(state.profile.id, filename)))
        return;
      const result = await this.checkpointRequest(state, "restore", filename);
      await this.checkpoints.touch(state.profile.id, filename);
      state.restoredTokens = result.n_restored;
      this.cacheNotice =
        "Restored " +
        result.n_restored +
        " cached tokens for " +
        state.profile.name;
    } catch (error) {
      this.cacheNotice = "Checkpoint skipped: " + error.message;
      if (
        error.status === 400 ||
        error.status === 404 ||
        error.kind === "invalid"
      )
        await this.checkpoints
          .discard(state.profile.id, filename)
          .catch(() => {});
    }
    this.changed();
  }
  async saveCheckpoint(state, options) {
    const session = this.checkpointSession(options);
    if (!session || this.purging) return;
    const filename = this.checkpoints.filename(
      session,
      this.checkpointSignature(state, options),
    );
    try {
      await this.checkpointRequest(state, "save", filename);
      await this.checkpoints.touch(state.profile.id, filename);
      const result = await this.checkpoints.prune(state.profile.id);
      this.cacheNotice =
        "Saved checkpoint for " +
        state.profile.name +
        (result.evicted ? "; oldest unused checkpoints evicted" : "");
    } catch (error) {
      this.cacheNotice = "Checkpoint was not saved: " + error.message;
    }
    this.changed();
  }
  async stop(id) {
    const state = this.servers.get(id);
    if (!state) return;
    if (state.active)
      throw new Error("Wait for the active answer before unloading");
    await terminate(state.child);
    this.servers.delete(id);
    this.changed();
  }
  async stopAll() {
    for (const id of this.servers.keys()) await this.stop(id);
  }
  async browse(path = homedir()) {
    if (!isAbsolute(path)) throw new Error("Use an absolute host folder path");
    const directories = [],
      files = [];
    for (const entry of await readdir(path, { withFileTypes: true })) {
      try {
        if (
          entry.isDirectory() ||
          (entry.isSymbolicLink() &&
            (await stat(join(path, entry.name))).isDirectory())
        )
          directories.push(entry.name);
        else if (
          entry.name.toLowerCase().endsWith(".gguf") &&
          (await stat(join(path, entry.name))).isFile()
        )
          files.push(entry.name);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "EACCES") throw error;
      }
    }
    return {
      path,
      parent: dirname(path),
      directories: directories.sort(),
      files: files.sort(),
    };
  }
  async addModels(ids) {
    const models = ids.map((id) =>
      this.inventory?.models.find((model) => model.id === id),
    );
    if (
      models.some(
        (model) =>
          !model || model.status !== "complete" || isControlVector(model),
      )
    )
      throw new Error("Select complete, unambiguous models");
    const added = [];
    for (const model of models) {
      const existing = this.profiles.find(
        (profile) => profile.model?.id === model.id,
      );
      if (existing) {
        added.push(existing.id);
        continue;
      }
      let port = 8190;
      while (this.profiles.some((profile) => profile.port === port)) port++;
      const profile = createProfile(model, port);
      profile.projector = findProjector(model, this.inventory);
      profile.projectorChoice = profile.projector ? "auto" : "";
      if (supportsFlashMtp(model) && this.inventory.mtpRuntimes?.length === 1)
        profile.mtp = await inspectMtpRuntime(this.inventory.mtpRuntimes[0]);
      this.profiles.push(profile);
      added.push(profile.id);
    }
    await this.store.write("profiles", this.profiles);
    this.changed();
    return added;
  }
  async inspectProjector(path) {
    if (!isAbsolute(path))
      throw new Error("Choose an absolute mmproj GGUF path");
    const result = await this.execute(this.settings.python, [
      "-B",
      join(packageRoot, "python/gguf.py"),
      path,
    ]);
    const file = JSON.parse(result.stdout);
    if (file.role !== "Vision")
      throw new Error(
        "Choose a vision projector (mmproj) GGUF, not a main model shard",
      );
    return { path: file.path };
  }
  async engineHelp(runtime, profile) {
    const native = profile?.model?.architecture === "qwen35moe";
    const modelPath =
      profile?.model?.files?.find((file) => file.index === 1)?.path ||
      profile?.config?.args?.[profile.config.args.indexOf("--native") + 1];
    const args =
      native && modelPath ? ["--native", modelPath, "--help"] : ["--help"];
    const result = await this.execute(runtime.executable, args, {
      env: {
        LD_LIBRARY_PATH: [
          dirname(runtime.executable),
          this.settings.executable && dirname(this.settings.executable),
          process.env.LD_LIBRARY_PATH,
        ]
          .filter(Boolean)
          .join(":"),
      },
    });
    return result.stdout + result.stderr;
  }
  ensureRuntime() {
    if (!this.settings.executable)
      return this.jobs.add("Install Strata", (signal, report) =>
        this.installRuntime(signal, report),
      );
  }
  async installRuntime(signal, report = () => {}) {
    if (this.servers.size)
      throw new Error("Unload models before installing the runtime");
    const result = await this.execute(
      "python3",
      [
        "-B",
        join(packageRoot, "python/install.py"),
        join(this.root, "runtime", runtimeVersion),
      ],
      { signal, onData: report, timeout: 60 * 60 * 1000 },
    );
    const installed = receipt(result.stdout);
    this.settings = await bundledRuntime(installed.root, packageRoot);
    if (!this.settings)
      throw new Error("The included Strata runtime could not be loaded");
    for (const profile of this.profiles) profile.config = null;
    await this.store.write("profiles", this.profiles);
    await this.store.write("settings", this.settings);
    return this.settings;
  }
  async action(action, payload = {}) {
    this.shutdown.signal.throwIfAborted();
    switch (action) {
      case "purge-cache":
        return this.jobs.add("Purge all cache", async (signal, report) => {
          this.purging = true;
          try {
            while (this.answering) {
              report("Waiting for the active answer to finish");
              await delay(100, undefined, { signal });
            }
            await this.stopAll();
            await rm(join(this.root, "cache"), {
              recursive: true,
              force: true,
            });
            await mkdir(join(this.root, "cache", "tmp"), {
              recursive: true,
              mode: 0o700,
            });
            this.cacheNotice = "All conversation caches and checkpoints purged";
            return { purged: true };
          } finally {
            this.purging = false;
            this.changed();
          }
        });
      case "state":
        return this.state();
      case "browse":
        return this.browse(payload.path);
      case "projector":
        return this.inspectProjector(payload.path);
      case "mtp-runtime":
        return { path: await inspectMtpRuntime(payload.path) };
      case "capabilities": {
        const profile = this.profile(payload.id);
        if (profile.model?.architecture === "qwen35moe")
          return { kv: ["fp32"] };
        const runtime = modelRuntime(this.settings, profile);
        if (!runtime.executable) return { kv: null };
        return { kv: supportedKv(await this.engineHelp(runtime, profile)) };
      }
      case "catalog":
        return this.settings.controlDir
          ? this.bridge("catalog", {}, this.shutdown.signal)
          : JSON.parse(
              await readFile(join(packageRoot, "catalog.json"), "utf8"),
            );
      case "import":
      case "scan":
        return this.jobs.add(
          "Scan folders",
          async (signal, report) => {
            report("Reading GGUF headers and grouping shards");
            const result = await this.execute(
              this.settings.python,
              [
                "-B",
                join(packageRoot, "python/scanner.py"),
                payload.path,
                ...(payload.files?.length ? ["--files", ...payload.files] : []),
              ],
              { signal, timeout: 30 * 60 * 1000 },
            );
            this.inventory = JSON.parse(result.stdout);
            await this.store.write("inventory", this.inventory);
            signal.throwIfAborted();
            const ids =
              action === "import"
                ? await this.addModels(
                    this.inventory.models
                      .filter((model) => model.status === "complete")
                      .map((model) => model.id),
                  )
                : [];
            return {
              ids,
              files: this.inventory.filesScanned,
              models: this.inventory.models.length,
            };
          },
          { serial: false },
        );
      case "add": {
        if (this.jobs.busy())
          throw new Error("Wait for the current work to finish");
        return this.addModels(payload.ids);
      }
      case "save":
        return this.save(payload.profile);
      case "remove":
        if (this.jobs.busy()) throw new Error("Wait for pending work");
        await this.stop(payload.id);
        this.profiles = this.profiles.filter((p) => p.id !== payload.id);
        await this.store.write("profiles", this.profiles);
        this.changed();
        return {};
      case "settings": {
        if (this.jobs.busy() || this.servers.size)
          throw new Error(
            "Finish pending work and unload models before changing the runtime",
          );
        const settings = payload.settings;
        for (const key of ["controlDir", "python", "executable"])
          if (typeof settings[key] !== "string")
            throw new Error("Invalid runtime paths");
        this.settings = settings;
        // Prepared configs contain runtime paths; rebuild them after a global change.
        for (const profile of this.profiles) profile.config = null;
        await this.store.write("profiles", this.profiles);
        await this.store.write("settings", settings);
        return settings;
      }
      case "install":
        return this.jobs.add("Install Strata", (signal, report) =>
          this.installRuntime(signal, report),
        );
      case "download":
        return this.jobs.add(
          "Download and install model",
          async (signal, report) => {
            if (!this.settings.executable)
              await this.installRuntime(signal, report);
            const root = join(
              this.root,
              "downloads",
              payload.selection.family +
                "-" +
                payload.selection.model.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
            );
            const result = await this.bridge(
              "download",
              { selection: payload.selection, root },
              signal,
              report,
            );
            const config = result.config;
            const id =
              payload.selection.family +
              "-" +
              payload.selection.model.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
            let port = 8190;
            while (this.profiles.some((p) => p.port === port)) port++;
            const profile = createProfile(
              {
                name: id,
                architecture:
                  payload.selection.family === "qwen36"
                    ? "qwen35moe"
                    : payload.selection.family === "deepseek41"
                      ? "deepseek4"
                      : "qwen4exp",
                files: [],
              },
              port,
            );
            config.lib_dirs = [dirname(this.settings.executable)];
            profile.config = config;
            const kvIndex = config.args.indexOf("--kv");
            profile.kv =
              kvIndex >= 0
                ? kvLabel(config.args[kvIndex + 1])
                : profile.model.architecture === "deepseek4"
                  ? "engine"
                  : "FP16/FP16";
            profile.context =
              Number(config.args[config.args.indexOf("--max-context") + 1]) ||
              (payload.selection.family === "deepseek41" ? 8192 : 32768);
            if (this.settings.executable && !config.exe?.includes("dsv41"))
              profile.config.exe = this.settings.executable;
            this.profiles.push(profile);
            await this.store.write("profiles", this.profiles);
            this.changed();
            if (payload.tune) await this.tune(profile.id, signal, report);
            return { id: profile.id };
          },
        );
      case "prepare":
        return this.jobs.add("Prepare model", (signal, report) =>
          this.prepare(payload.id, signal, report).then((p) => ({ id: p.id })),
        );
      case "tune": {
        const ids = payload.ids || [payload.id];
        return this.jobs.add("Tune models", async (signal, report) => {
          const results = [];
          for (const id of ids) {
            report("Tuning " + this.profile(id).name);
            results.push(await this.tune(id, signal, report));
          }
          return results;
        });
      }
      case "start":
        await this.start(payload.id);
        return {};
      case "stop":
        await this.stop(payload.id);
        return {};
      case "help": {
        const profile = payload.id ? this.profile(payload.id) : undefined;
        const runtime = profile
          ? modelRuntime(this.settings, profile)
          : this.settings;
        if (!runtime.executable) throw new Error("Install an engine first");
        return (
          await this.execute(runtime.executable, ["--help"], {
            signal: this.shutdown.signal,
            env: {
              ...profile?.environment,
              ...(process.platform === "linux"
                ? {
                    LD_LIBRARY_PATH: [
                      dirname(runtime.executable),
                      this.settings.executable &&
                        dirname(this.settings.executable),
                      profile?.environment?.LD_LIBRARY_PATH,
                      process.env.LD_LIBRARY_PATH,
                    ]
                      .filter(Boolean)
                      .join(":"),
                  }
                : {}),
            },
          })
        ).stdout;
      }
      case "cancel":
        this.jobs.cancel(payload.id);
        return {};
      default:
        throw new Error("Unknown Strata operation");
    }
  }
  async dispose() {
    this.shutdown.abort();
    await this.jobs.close();
    for (const state of this.servers.values()) await terminate(state.child);
    this.servers.clear();
    await Promise.allSettled([this.loadTail, this.requestTail]);
    await this.store.tail;
  }
}
