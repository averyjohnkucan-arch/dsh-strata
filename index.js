import z from "@deepseek-ai/schemastery";
import { StrataService } from "./lib/service.js";
import { StrataAdapter } from "./lib/adapter.js";
import { actionPath, handler } from "./lib/http.js";

export const inject = ["llm", "connection"];
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
  // Exact Connection routes use DSH's existing owner session. No plugin token can
  // become stale when this plugin reloads or the server restarts.
  ctx.effect(() =>
    ctx.connection.fetch.register({
      path: actionPath,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: handler(service),
    }),
  );
}
