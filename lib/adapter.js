import {
  LlmAdapter,
  LlmError,
  resolveRetryPolicy,
  resolveImageAttachmentAccess,
} from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { thinkingInfo, thinkingPreset, projectionContext } from "./thinking.js";

/** DSH owns wire conversion, tools, streaming and image attachment handling. */
export class StrataAdapter extends LlmAdapter {
  constructor(ctx, service) {
    super();
    this.ctx = ctx;
    this.service = service;
  }
  providerInfo(provider) {
    return { id: provider, name: "Strata" };
  }
  profile(id) {
    try {
      return this.service.profile(id);
    } catch {
      throw new LlmError("Saved Strata model not found", "UNKNOWN_MODEL");
    }
  }
  async listModels(provider) {
    return this.service.profiles.map((p) => ({
      provider,
      id: p.id,
      name: p.name,
      inputModalities: p.projector ? ["text", "image"] : ["text"],
    }));
  }
  delegate(provider, p, preset = thinkingPreset(p)) {
    const model = {
      id: p.id,
      name: p.name,
      api: "openai-completions",
      provider,
      baseUrl: `http://127.0.0.1:${p.port}/v1`,
      reasoning: true,
      thinkingLevelMap: { xhigh: "xhigh" },
      input: p.projector ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: p.context,
      maxTokens: Math.min(p.context, 32768),
      compat: { supportsDeveloperRole: false, supportsStore: false },
    };
    const api = openAICompletionsApi();
    const piProvider = createProvider({
      id: provider,
      name: "Strata",
      baseUrl: model.baseUrl,
      auth: { apiKey: { name: "Strata", resolve: async () => ({ auth: {} }) } },
      models: [model],
      api: {
        ...api,
        streamSimple(model, context, options) {
          return api.streamSimple(model, context, {
            ...options,
            // Keep DSH/pi-ai's wire conversion; add only Strata's documented request controls.
            onPayload(payload) {
              return {
                ...payload,
                reasoning_effort: preset.effort,
                experimental_speed_projection: preset.projection,
              };
            },
          });
        },
      },
    });
    const profiles = new Map([
      [
        provider,
        {
          provider,
          displayName: "Strata",
          piProvider,
          modelErrors: new Map(),
          configuredMaxTokens: new Map(),
          streamIdleTimeoutMs: 900000,
          maxRequestImageBytes: 20 * 1024 * 1024,
          requestImagePixelBudget: 4 * 1024 * 1024,
          requestImageMaxBytes: 1024 * 1024,
          retryPolicy: resolveRetryPolicy(),
          headers: {},
        },
      ],
    ]);
    return new PiAiAdapter({
      profiles: () => profiles,
      resolveApiKey: async () => "dsh-local",
      auth: {
        credentials: {
          read: async () => undefined,
          list: async () => [],
          modify: async () => {
            throw new Error("Configure local engine credentials in Strata");
          },
          delete: async () => {},
        },
        authContext: {
          env: async () => undefined,
          fileExists: async () => false,
        },
      },
      resolveAttachments: () => this.ctx.get("attachments"),
      resolveImageAccess: (attachments, ref) =>
        resolveImageAttachmentAccess(
          attachments,
          (path) => this.ctx.get("fs")?.processPathFromHostPath(path),
          ref,
        ),
    });
  }
  async resolveModel(provider, id, signal) {
    const profile = this.profile(id);
    const model = await this.delegate(provider, profile).resolveModel(
      provider,
      id,
      signal,
    );
    return { ...model, reasoning: thinkingInfo(profile) };
  }
  async prepareCall(provider, id, signal) {
    const adapter = this,
      service = this.service,
      profile = this.profile(id);
    const model = await this.resolveModel(provider, id, signal);
    return {
      model,
      async *stream(options) {
        const preset = thinkingPreset(profile, options.reasoningEffort);
        const checkpointOptions = { ...options, projection: preset.projection };
        const combined = options.signal
          ? AbortSignal.any([options.signal, service.shutdown.signal])
          : service.shutdown.signal;
        const lease = await service.acquire(id, combined);
        const admittedSignal = lease.signal || combined;
        let finished = false;
        try {
          admittedSignal.throwIfAborted();
          await service.restoreCheckpoint(lease.state, checkpointOptions);
          const call = await adapter
            .delegate(provider, profile, preset)
            .prepareCall(provider, id, admittedSignal);
          let saveable = false;
          for await (const chunk of call.stream({
            ...options,
            system: projectionContext(
              profile,
              options.system,
              preset.projection,
            ),
            reasoningEffort: preset.effort,
            signal: admittedSignal,
          })) {
            if (chunk.type === "finish")
              saveable = ["stop", "tool-calls", "max-tokens"].includes(
                chunk.reason.kind,
              );
            yield chunk;
          }
          finished = saveable && !admittedSignal.aborted;
        } finally {
          try {
            if (finished)
              await service.saveCheckpoint(lease.state, checkpointOptions);
          } finally {
            lease.release();
          }
        }
      },
    };
  }
  async *stream(options) {
    const call = await this.prepareCall(
      options.provider,
      options.model,
      options.signal,
    );
    yield* call.stream(options);
  }
}
