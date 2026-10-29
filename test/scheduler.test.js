import test from "node:test";
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import { StrataService } from "../lib/service.js";
import { attachScheduler } from "../lib/scheduler.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
function fixture() {
  const service = new StrataService();
  service.profiles = [{ id: "s", name: "Gyro S", gpu: 0 }];
  service.startServer = async () => ({ active: 0, ready: true });
  return service;
}

test("optional scheduler attaches and detaches without a hard plugin dependency", async () => {
  const ctx = new Context(),
    service = fixture();
  const scope = ctx.plugin({
    name: "strata-fixture",
    apply: (scope) => attachScheduler(scope, service),
  });
  await scope;
  assert.equal(service.scheduler, undefined);
  const events = [];
  const scheduler = {
    registerProvider(name, list) {
      events.push([name, list()[0].key]);
      return () => events.push("unregister");
    },
    async unload(key) {
      events.push("unload " + key);
    },
  };
  const remove = ctx.provide("modelScheduler", scheduler);
  await tick();
  assert.equal(service.scheduler, scheduler);
  assert.deepEqual(events[0], ["strata", "strata:s"]);
  await remove();
  assert.equal(service.scheduler, undefined);
  assert.deepEqual(events.slice(1), ["unregister", "unload strata:s"]);
  await ctx.fiber.dispose();
});

test("the shared lease covers checkpoint IO and release is idempotent", async () => {
  const service = fixture();
  let released = 0;
  const controller = new AbortController();
  service.scheduler = {
    async acquire(driver) {
      assert.equal(driver.key, "strata:s");
      return {
        state: await driver.load(controller.signal),
        signal: controller.signal,
        release() {
          released++;
        },
      };
    },
  };
  const lease = await service.acquire("s");
  assert.equal(lease.signal, controller.signal);
  assert.equal(released, 0);
  assert.equal(service.answering, 1);
  assert.equal(lease.state.active, 1);
  lease.release();
  lease.release();
  assert.equal(released, 1);
  assert.equal(lease.state.active, 0);
  assert.equal(service.answering, 0);
});

test("cancelling a queued request cannot unlock a different model's answer", async () => {
  const service = fixture(),
    controller = new AbortController();
  let starts = 0;
  service.startServer = async () => {
    starts++;
    return { active: 0 };
  };
  const first = await service.acquire("s");
  const queued = service.acquire("s", controller.signal);
  controller.abort();
  await assert.rejects(queued, { name: "AbortError" });
  const next = service.acquire("s");
  await tick();
  assert.equal(starts, 1);
  assert.equal(service.answering, 2);
  first.release();
  (await next).release();
  assert.equal(starts, 2);
  assert.equal(service.answering, 0);
});

test("failed shared admission releases the local queue for a later retry", async () => {
  const service = fixture();
  let attempts = 0;
  service.scheduler = {
    async acquire() {
      if (++attempts === 1) throw new Error("Native allocation failed");
      return { state: { active: 0 }, release() {} };
    },
  };
  await assert.rejects(service.acquire("s"), /allocation/);
  assert.equal(service.answering, 0);
  (await service.acquire("s")).release();
  assert.equal(service.answering, 0);
});

test("native tuning reserves the same GPU and releases it after failure", async () => {
  const service = fixture(),
    events = [];
  service.scheduler = {
    async acquire(driver) {
      events.push([driver.key, driver.gpu]);
      return {
        signal: new AbortController().signal,
        release: () => events.push("release"),
      };
    },
    async unload(key) {
      events.push("unload " + key);
    },
  };
  service.tuneLocal = async () => {
    throw new Error("Tuner failed");
  };
  await assert.rejects(
    service.tune("s", undefined, () => {}),
    /Tuner failed/,
  );
  assert.deepEqual(events, [
    ["strata:tune:s", 0],
    "release",
    "unload strata:tune:s",
  ]);
});
