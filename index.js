import z from "@deepseek-ai/schemastery";
import { randomBytes } from "node:crypto";
import { StrataService } from "./lib/service.js";
import { StrataAdapter } from "./lib/adapter.js";
import { handler } from "./lib/http.js";

export const inject = ["llm", "webServer"];
export const Config = z.object({
  dataDir: z
    .string()
    .description("Private Strata profiles, runtime and downloads.")
    .default(""),
});

export async function apply(ctx, config) {
  let registration;
  const service = new StrataService(config, () => {
    try {
      registration?.replace(["strata"]);
    } catch (error) {
      if (error.code === "REGISTRATION_DISPOSED") registration = undefined;
      else throw error;
    }
  });
  await service.init();
  // Register cleanup first, so partially failed plugin activation still releases processes.
  ctx.effect(() => () => service.dispose());
  ctx.effect(() => {
    const owned = ctx.llm.registerAdapter(
      ["strata"],
      new StrataAdapter(ctx, service),
    );
    registration = owned;
    return () => {
      registration = undefined;
      owned();
    };
  });
  const path = "/plugins/dsh-strata/action",
    token = randomBytes(32).toString("hex");
  ctx.on("webserver/index-inject", (table) =>
    table.push({
      kind: "global",
      name: "__DSH_STRATA__",
      value: { path, token },
    }),
  );
  ctx.effect(() =>
    ctx.webServer.register({
      kind: "exact",
      path,
      handler: handler(service, token, () => ctx.webServer.getOrigin()),
    }),
  );
}
