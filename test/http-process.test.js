import test from "node:test";
import assert from "node:assert/strict";
import { execute, receipt } from "../lib/process.js";
import { actionPath, handler } from "../lib/http.js";

// Authentication is supplied by DSH's exact Connection route, never a plugin-global token.
async function call({
  method = "POST",
  contentType = "application/json",
  body = JSON.stringify({ action: "echo", payload: { name: "模型🌍" } }),
} = {}) {
  let calls = 0;
  const response = await handler({
    action: async (_action, payload) => {
      calls++;
      return payload;
    },
  })(
    new Request("http://localhost" + actionPath, {
      method,
      headers: { "content-type": contentType },
      ...(method === "GET" ? {} : { body }),
    }),
  );
  return { status: response.status, response: await response.json(), calls };
}
test("the owner-authenticated Connection route preserves UTF-8 JSON", async () => {
  const result = await call();
  assert.equal(result.status, 200);
  assert.equal(result.response.result.name, "模型🌍");
  assert.ok(actionPath.startsWith("/api/"));
});
test("invalid methods, bodies and content types never invoke host operations", async () => {
  for (const options of [
    { method: "GET" },
    { contentType: "application/json-attacker" },
    { body: "broken json" },
    { body: "x".repeat(4 * 1024 * 1024 + 1) },
  ]) {
    const result = await call(options);
    assert.notEqual(result.status, 200);
    assert.equal(result.calls, 0);
  }
});
test("subprocess runner preserves argv literally and decodes UTF-8", async () => {
  const result = await execute(process.execPath, [
    "-e",
    "console.log(process.argv[1])",
    "$(touch /tmp/never-execute-this) 模型",
  ]);
  assert.equal(result.stdout.trim(), "$(touch /tmp/never-execute-this) 模型");
});
test("missing executable and already-aborted work fail promptly", async () => {
  await assert.rejects(() => execute("/nonexistent-dsh-strata-fixture", []), {
    code: "ENOENT",
  });
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => execute(process.execPath, [], { signal: controller.signal }),
    { name: "AbortError" },
  );
});
test("a process exiting zero after timeout is still a timeout failure", async () => {
  await assert.rejects(
    () =>
      execute(
        process.execPath,
        [
          "-e",
          "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)",
        ],
        { timeout: 150 },
      ),
    /timed out/,
  );
});
test("native completion receipts are required", () => {
  assert.equal(receipt('log\nDSH_RESULT={"ok":true}\n').ok, true);
  assert.throws(() => receipt("finished"), /receipt/);
});
