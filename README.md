# Strata for DeepSeek Harness

Manage official stock Strata models, vision/projector files, MTP and saved profiles inside DSH. Uses upstream auto-tune, with optional engine extensions kept separate and off by default.

## Install in DSH

Requires DeepSeek Harness **0.2.1-rc.2**, running its Web profile.

1. Open **Plugins → Add plugin → GitHub**.
2. Paste `https://github.com/averyjohnkucan-arch/dsh-strata`.
3. Install and enable the plugin. Reload the browser, or restart DSH if its manager requests it.
4. Open **Settings → Models → Strata**.

The plugin is a ready-to-install Cordis bundle. It does not patch DSH, replace its UI, install a second DSH, or require a plugin compilation step. Its package uses DSH's shipped peers, so installation does not download another provider stack or ask to run provider dependency build scripts.

## Models

Choose **Add model**, then **Select model files**. Browse the host's model directory and select multiple files, or **Select all model files here**. You can navigate between directories while retaining the selection. **Inspect and assign** reads headers and assigns the main model, its ordered shards, the vision projector and MTP. It reports missing shards, mixed main-model sets and unsupported MTP formats.

Edit the profile and save. **Start** prepares a missing runtime/model pack before starting the server. Runtime installation and model preparation show progress and can be cancelled. Existing installed engines and prepared packs can be selected under **Runtime and imported model data**. The model becomes available in DSH's conversation model picker after saving.

**Edit** reopens a saved profile. **Remove profile** deletes its saved configuration and stops its owned process; downloaded model files are retained. **Attach running server** explicitly connects to an already-running server advertising the profile's model ID. Stopping or disabling an attachment only detaches; it never terminates the external process. Launch settings are not applied to an external server.

All documented inference flags from the pinned executable's help have controls under **All engine CLI options**. Blank means the engine default; boolean **Omit flag** means the flag is not passed, not that an engine-default feature is necessarily disabled. The complete JSON editor supports repeated flags as arrays and multi-value flags as `{"argv":["first","second"]}`. Additional argv is an array, never a shell string. Environment variables and the complete server configuration are also editable.

## Updates, disable and removal

Update each repository independently through DSH's plugin manager. Turn its switch off to remove its card, provider registration and tools, and stop the servers it owns. Remove the bundle to uninstall its code. Saved profiles and runtime data remain in `~/.dsh/dsh-strata/` (or `$DSH_HOME/dsh-strata/`) so reinstalling restores them. Delete that plugin-owned data directory separately if you want a complete reset. Neither plugin requires the other.

## Integration

The package declares `dsh.bundle.patch` and `dsh.client`; the patch inserts only its own Cordis row. The client registers React UI through the documented `settings.models.footer` slot and uses DSH theme tokens and locale service. The Host registers an `LlmAdapter` through `ctx.llm.registerAdapter`, delegates wire conversion, images and replay to DSH's public `PiAiAdapter`, and owns a separate `ctx.webServer.register` route. An ephemeral bearer capability supplied through `webserver/index-inject` protects its JSON actions. There is no iframe, DOM injection or replacement of built-in provider cards.

Registrations and process lifetimes are owned by `ctx.effect`/`ctx.on`. The agent-facing `strata_models` tool uses the same operations as the card and DSH's `approveEscalation` mechanism; host-management calls require Full access or explicit per-call approval. UI actions require the owner's page capability. This initial version targets the local Web profile; remote delegated access and Electron-only profiles have not been validated.

## Development

```sh
pnpm install --ignore-scripts
pnpm test
pnpm run check
```

Node 22.19+ is required. Development provider dependencies may report skipped optional install scripts; the published plugin has no install scripts and consumes DSH's installed peer packages. The two repositories contain their own code and tests and can be developed separately.

## Strata runtime and supported formats

Engine source: [Niko1221/Strata](https://github.com/Niko1221/Strata), release **v0.2.6**, revision `4b9e05a2a806a3fe24f7b2560d98626c37dade35`. This release contains Control 0.1.51 and the unchanged Qwen engine 0.1.50. Installation verifies the official archive SHA-256 checksums. The stock path downloads prebuilt binaries and a private Python runtime; it does not compile an engine or modify system Python.

Automatic installation supports Linux x86-64 NVIDIA, choosing the official CUDA 12 or CUDA 13 archive from the installed driver. Other platforms require manually configured compatible runtime paths and are not qualified by this plugin release. NVFP4 routed experts are **already upstream** and need no optional patch; use a compatible Flash-Next NVFP4 model and pack. NVFP4 is not a KV-cache format.

GGUF import supports **qwen4exp / Flash-Next** and **qwen35moe / Qwen3.6 35B A3B**. Flash-Next uses upstream `iq_pack.py`; native Qwen keeps its original weights and extracts the tokenizer. An existing prepared pack can be selected directly. This plugin does not yet provision the separate DeepSeek V4.1 engine.

Stock Flash-Next KV formats are FP16/FP16, Q8/Q8, Q8/Q4 and Q4/Q4. Stock native Qwen uses **FP32 KV** and embedded MTP. Its external disk checkpoints and partial KV residency are unavailable. UI choices and final launch validation reflect those differences.

### Optional engine extensions

Under **Optional engine extensions**, enable each desired capability separately, save, then select **Build / apply saved extensions** (Load also prepares them). The plugin applies only the selected patches to a pinned, private stock checkout. Enabling a capability does not change the selected KV format; choose that separately. Disable all extensions to return to the verified stock binary.

| Checkbox | Additional capability |
| --- | --- |
| Flash-Next Q6 KV | Q6/Q6, Q8/Q6, Q6/Q8, FP16/Q6 |
| Flash-Next Q5 KV | Q8/Q5, Q5/Q5, Q5/Q4 |
| Flash-Next FP16/Q8 KV | FP16 keys and Q8 values |
| Qwen3.6 INT8 KV | Q8/Q8 cache for the native Qwen driver |
| Qwen3.6 external MTP donor | Compatible donor GGUF for a target without embedded MTP |

Extensions require a CUDA toolkit (`nvcc`, optionally via `CUDA_HOME`), CMake 3.24+, Git and a C++20 compiler. Mixed KV cannot use parked conversation cache, elastic KV growth or this plugin's disk checkpoints. External MTP requires a positive draft count, matching geometry/tokenizer and a target without embedded MTP. These extensions are opt-in: build and kernel checks do not establish model quality or speed. See [migration and limits](docs/MIGRATION.md) and [patch provenance](patches/NOTICE.md).

Vision choices remain Auto, GPU, iGPU/Vulkan, CPU and Off. Auto uses the configured iGPU reader on GPUs with at most 12 GiB, otherwise CPU fallback; larger cards prefer GPU. Stock installation includes the upstream vision reader. A Vulkan reader and device index must be supplied separately for iGPU use.

## Saved configurations and migration

Use **Import saved Strata configuration** for a compatible JSON run configuration. Its original argv order is retained until an inference control changes, with final capability validation. Imports record provenance and do not run inference.

On the first load after upgrading, the plugin backs up the entire old profiles file before migration. Model weights and original tokenizer files remain in place. Unleashed runtime paths and settings are retained in `legacyEngine` and the backup; fork-only precision, donor and launch flags are disabled for the stock default. Existing independent `llama-server` profiles are preserved. Installing an engine is an explicit background operation triggered by Setup or Load.

## Stock auto-tune

Open **Automatic tuning** and choose **Quick** or **Thorough**, goal **Speed** or **Room**, and **Chat** or **Coding** workload. Save, unload managed models, then select **Tune saved profile**. Quick may take about 20 minutes; thorough about two hours. The plugin calls upstream `strata.py tune auto` and displays its progress/result. It does not substitute its former custom tuner.

Speed seeks measured throughput, not a promise of 100% VRAM occupancy. Room reserves more headroom. **Leave system RAM (%)** concerns system RAM, not GPU VRAM. Small answer differences and non-repeatable results require their own explicit checkboxes.

**Apply saved preset on launch** resolves the active upstream preset for that model, hardware and workload. Invalid/stale presets follow upstream handling. Preset choices may override manual inference settings; turn the checkbox off to use only manual settings. The final applied launch configuration participates in checkpoint identity. Tuning must return a confirmed result and a saved preset ID before the plugin reports success.

When Start or a chat finds an existing server on the saved port, it reuses it only if `/v1/models` advertises the exact saved model ID. Stop only detaches an external server. Changed launch settings require restarting it in its owning application. Managed GPU work uses the optional Model Scheduler service; tuning and extension validation request background admission.

## Per-model reasoning settings

Edit a model profile to add/remove reasoning levels, give each a display name,
and set the exact `reasoning_effort` backend value. Choose a default level, or
Engine default to leave the request unspecified. Custom names and values are
supported; availability is declared per profile, not assumed for every model.
The engine/template must accept the configured backend values.

Qwen3.8 profiles start with Off (thinking disabled), Low → `low`, Medium → `medium`, and XHigh → `xhigh`,
with Medium as default. The conversation model picker uses these profile-owned
settings through DSH's existing adapter reasoning metadata. No DSH core patch
is required. An empty level list hides the reasoning selector for that profile.

## Model Scheduler integration

Optionally install `dsh-model-scheduler` for shared GPU admission, queued chat switching, manual load/unload and separate configurable idle retention (five minutes by default) and switch grace (30 seconds by default). This provider remains independently usable. Scheduling policy lives in that separate Cordis service; no Harness core changes are required. Owned engine process groups are stopped before GPU release is reported. External servers are detached, never killed.

## Per-chat native KV checkpoints

Enabled by default for managed single-slot servers; turn it off in a profile’s KV checkpoints section. Checkpoints live under `<dataDir>/kv/chats/<hashed-session-id>/`, default `~/.dsh/dsh-strata/kv`. The latest native snapshot is kept for two model configurations per chat. Each successful model step saves the native slot to a private file, syncs it and atomically publishes its catalog entry before deleting the superseded snapshot. Failed saves preserve the last committed snapshot. Aborted/failed steps retain their earlier checkpoint. Auxiliary title/compaction calls do not replace a chat checkpoint.

Restores happen before generation, including after process restart. A new chat can restore the compatible snapshot with the longest matching system/message prefix; the engine validates its native format and computes the actual token prefix. Launch settings, model paths and file timestamps participate in compatibility checks. Restores never add old messages to a new conversation. Chat operations are serialized around restore/generate/save because the native API exposes slot 0. Large checkpoints require real disk/PCIe transfer time. Full OS power-loss testing has not been performed. Native parallel/batch mode does not support disk snapshots; its API reports that limitation and the card shows a KV warning. Externally managed servers are not checkpointed by this plugin.

The **Off** reasoning level disables thinking with `chat_template_kwargs.enable_thinking=false`; it does not send the literal `off` as an unsupported reasoning-effort value. Existing version-1 model profiles gain Off once on upgrade; custom names and Medium defaults are preserved. Set a custom row's backend value to `off` for the same behavior.

The provider marks the leading system/tool message with Strata's native shared-prefix metadata. For Qwen templates that reject system-only rendering, it prepares a tokenizer copy under the plugin data directory: only the non-generation prefix-rendering check is relaxed. Normal generation retains the original check and prompt output. Original tokenizer/model files are never edited. Other templates are used unchanged.

### Independent starting checkpoint

Fresh chats use a separate `kv/bases/` checkpoint keyed to the model and exact system/tool/rendering configuration. The base survives per-chat model eviction; changes create a new compatible base once. Existing chats prefer their latest per-step checkpoint. Each chat keeps its last two model configurations, with successful saves replacing the preceding step for that configuration.

The native server retains state only after a generation request. The plugin builds a base using system/tools, a blank synthetic user message and one discarded token. No real user or assistant history enters that request. The native `strata_prefix` anchor restricts reuse to the matching system/tool prefix before the real user prompt. The synthetic tail is never added to a conversation. Established chats do not pause to build new bases when their toolsets change. Legacy cross-chat matching is only a fallback when no base exists.

### Managed native GGUF profiles

Saved profiles with `nativeServer: "llama"` launch a compatible `llama-server`
through the same Cordis provider and shared scheduler. They use explicit native
context and FP16 or Q8 KV, preserve their configured model identity, and stop
only their owned process group. These profiles set `kvCache: false` to disable
Strata's incompatible checkpoint serialization; the native server still has its
normal inference KV cache. Per-mode `samplingPresets` are applied on the outgoing
DSH request, including separate image-input recommendations where supplied.
Registration is not a claim of model-format, memory-fit, quality or performance
qualification. Profiles marked as awaiting tuning retain unmeasured p?/d? labels.


## Recommended models and verified downloads

Open **Recommended models · exact revisions and hashes** in this plugin's settings card. The catalog records the checkpoints/components from the owner's configured setup with immutable repository revisions and SHA-256 (or Git blob hashes for small snapshot assets). Expand **Files, sizes and exact identities** before selecting a set.

**Download / verify recommended** saves a complete pinned set in this plugin's private `recommended-models` directory. Downloads resume from partial files, validate content before publishing final files, preserve existing models, and expose progress, cancellation and explicit failures. Repeating the action verifies/reuses existing files. Downloads do not start inference. **Add downloaded files** fills the existing model import/edit workflow for review and saving. Runtime installation remains separate.

Some configured artifacts are locally converted or assembled from multiple sources. Their exact local hashes are listed, but downloading the original publisher checkpoint cannot recreate those bytes. Use **Add existing model** and the normal importer for those entries. No incomplete component set is presented as a working download. Recommendations describe the saved setup; they do not establish memory fit or model quality on another computer.
