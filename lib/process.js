import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/** Processes get their own group so cancellation reaches Python's engine children. */
export function execute(
  command,
  args,
  { cwd, env, input, signal, onData = () => {}, timeout = 30_000 } = {},
) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      failure,
      killTimer;
    const stop = (error) => {
      failure ??= error;
      signalGroup(child, "SIGTERM");
      killTimer ??= setTimeout(() => signalGroup(child, "SIGKILL"), 2000);
    };
    const abort = () => stop(new Error("Cancelled"));
    const timer = setTimeout(
      () => stop(new Error(`${command} timed out after ${timeout} ms`)),
      timeout,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      stdout = (stdout + data).slice(-16_000_000);
      onData(data);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-100_000);
      onData(data);
    });
    child.stdin.on("error", () => {}); // A failed executable can close stdin before input is written.
    child.stdin.end(input === undefined ? undefined : JSON.stringify(input));
    child.on("error", (error) => {
      failure ??= error;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(new Error(`${command} exited ${code}: ${stderr.slice(-4000)}`));
      else resolve({ stdout, stderr });
    });
  });
}

export function signalGroup(child, signal) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export async function terminate(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    if (child.exitCode === null)
      await execute("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
    return;
  }
  const alive = () => {
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  signalGroup(child, "SIGTERM");
  for (let i = 0; i < 40 && alive(); i++) await delay(50);
  if (alive()) signalGroup(child, "SIGKILL");
  for (let i = 0; i < 40 && alive(); i++) await delay(50);
  if (alive()) throw new Error("The owned engine process group did not stop");
}

export function receipt(stdout) {
  const line = stdout
    .split("\n")
    .findLast((line) => line.startsWith("DSH_RESULT="));
  if (!line) throw new Error("Strata did not publish a completion receipt");
  return JSON.parse(line.slice("DSH_RESULT=".length));
}
