import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { execute, receipt } from "../lib/process.js";
import { handler } from "../lib/http.js";

async function call({
  token = "owner",
  origin,
  body = { action: "echo", payload: { name: "模型🌍" } },
  split = true,
  method = "POST",
  contentType = "application/json",
} = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  const req = Readable.from(
    split ? [...bytes].map((value) => Buffer.from([value])) : [bytes],
  );
  req.method = method;
  req.headers = {
    authorization: "Bearer " + token,
    origin,
    "content-type": contentType,
  };
  let status,
    response,
    calls = 0;
  const res = {
    setHeader() {},
    writeHead(value) {
      status = value;
    },
    end(value) {
      response = JSON.parse(value);
    },
  };
  await handler(
    {
      action: async (_action, payload) => {
        calls++;
        return payload;
      },
    },
    "owner",
    () => "http://localhost:3000",
  )(req, res);
  return { status, response, calls };
}
test("owner route preserves UTF-8 split across network chunks", async () => {
  const r = await call();
  assert.equal(r.status, 200);
  assert.equal(r.response.result.name, "模型🌍");
});
test("unauthorized or cross-origin requests never invoke host operations", async () => {
  for (const options of [
    { token: "wrong" },
    { origin: "http://other" },
    { method: "GET" },
    { contentType: "application/json-attacker" },
  ]) {
    const r = await call(options);
    assert.notEqual(r.status, 200);
    assert.equal(r.calls, 0);
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
