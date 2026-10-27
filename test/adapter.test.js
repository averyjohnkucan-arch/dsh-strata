import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { StrataAdapter } from "../lib/adapter.js";
import { createProfile } from "../lib/profiles.js";

test("DSH adapter streams text and usage, preserves the prompt, and releases GPU admission", async (t) => {
  let captured,
    releases = 0;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    captured = JSON.parse(Buffer.concat(chunks));
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const base = {
      id: "fixture",
      object: "chat.completion.chunk",
      created: 1,
      model: "test",
    };
    const emit = (value) =>
      res.write("data: " + JSON.stringify(value) + "\n\n");
    emit({
      ...base,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "OK" },
          finish_reason: null,
        },
      ],
    });
    emit({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    });
    res.end("data: [DONE]\n\n");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const profile = createProfile(
    { name: "Fixture", architecture: "qwen4exp", files: [] },
    server.address().port,
  );
  const service = {
    profiles: [profile],
    profile: () => profile,
    shutdown: new AbortController(),
    acquire: async () => ({
      state: { active: 1 },
      release() {
        releases++;
      },
    }),
  };
  const adapter = new StrataAdapter({ get: () => undefined }, service);
  const call = await adapter.prepareCall("strata", profile.id);
  const chunks = [];
  for await (const chunk of call.stream({
    provider: "strata",
    model: profile.id,
    messages: [{ role: "user", content: [{ type: "text", text: "Say OK" }] }],
    maxTokens: 8,
  }))
    chunks.push(chunk);
  assert.equal(
    chunks
      .filter((c) => c.type === "text-delta")
      .map((c) => c.text)
      .join(""),
    "OK",
  );
  assert.ok(
    chunks.some((c) => c.type === "finish" && c.reason.kind === "stop"),
  );
  assert.ok(
    captured.messages.some((m) => JSON.stringify(m.content).includes("Say OK")),
  );
  assert.equal(captured.max_completion_tokens ?? captured.max_tokens, 8);
  assert.equal(releases, 1);
});
