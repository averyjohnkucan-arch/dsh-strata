# Strata for DeepSeek Harness

Manage Strata Unleashed GGUF models, vision/projector files, MTP, saved profiles and measured Flash Next tuning inside DSH.

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

Engine source: [StrataUnleashed](https://github.com/averyjohnkucan-arch/StrataUnleashed), pinned to `c73cde37581e6a79664176a08a232480c1b1fcfc`, the latest revision inspected for this release. Engine updates are explicit version changes, independent of saved model settings.

The automated setup currently builds the NVIDIA CUDA engine on Linux from that pinned source, creates a Python environment, installs the engine's requirements, and builds CPU/CUDA vision readers. It attempts a Vulkan vision reader and retains CPU fallback if Vulkan tools are unavailable. This requires Python with venv support, Git, CMake, Ninja, a C++ compiler and a compatible CUDA toolkit/driver. These system prerequisites are not installed with administrator privileges. Another supported engine binary can be supplied manually. This first release is not a universal precompiled engine distribution.

Automatic model packing currently supports **qwen4exp / Flash Next** using the fork's own `iq_pack.py`. Other architectures need an upstream-prepared compatible runtime pack. A selected MTP GGUF must be Strata's packed Q2_0 format accepted by `mtp_rt.py`; arbitrary standalone FP16/Q4/Q8 MTP GGUFs are recognized but explicitly rejected before conversion. A prepared MTP runtime is supported. MTP is never silently dropped and the tuner does not move it off the text GPU.

Vision choices are Auto, GPU, iGPU/Vulkan, CPU, and Off. Auto uses iGPU on cards with at most 12 GiB when a compatible Vulkan reader and device index are configured, otherwise CPU; larger cards prefer GPU. An independently configured CPU vision reader is the fallback. Vulkan device selection uses a plugin-owned launcher wrapper so its environment does not redirect the CUDA text engine. Automatic iGPU discovery is not implemented; supply the Vulkan index. GPU/CPU/iGPU vision execution has not been rebenchmarked for this plugin release.

Only the engine's actual mixed K/V formats are accepted: FP16/FP16, FP16/Q8, FP16/Q6, Q8/Q8, Q8/Q6, Q6/Q8, Q6/Q6, Q8/Q5, Q5/Q5, Q5/Q4, Q4/Q4. K/V dropdowns do not imply that every Cartesian combination is supported. The explicit expert-tail-skipping environment control can alter model output and is never enabled automatically by the tuner.

## Saved configurations

Use **Import saved Strata configuration** to import an existing JSON run configuration. Existing engine arguments are retained in their original order until an inference control changes. Supplied settings are locked against tuning. The import records the source-file SHA-256 and its existing validation status. Moving `/opt/prod/...` paths to an existing Local AI v2 location changes paths only.

The owner's local installation includes Atomic Chat Q5 Regular/Turbo and Gyro Large Regular/Turbo from Local AI v2. These machine-specific profiles and model weights are not bundled into this public repository. Their saved records contain pending validation statuses; importing them does not make them newly validated and does not run inference.

## Tuning

**Tune saved profile** is opt-in and measures the selected model on the current GPU. Editing a value enables **Keep my value**; clear it to let the tuner adjust that control. Imported existing tunes are locked. Failed or cancelled tuning preserves the previous saved tune.

The search starts at 80% resident KV, probes FP16/FP16, Q4/Q4 and Q8/Q8, refines supported pairs with K prioritized, searches resident cells when needed, and targets 6–10% free GPU memory. It measures decode candidates, then prefill candidates with a separate decode regression check capped at 5% loss. Finally it searches expert slots toward 0.7–1.5% free VRAM, retaining a larger margin if the next allocation does not fit. The final candidate is measured at the requested full context and checked again for short decode. MTP stays on GPU when configured.

The tuner records actual token usage, timings, observed free VRAM, every trial and manual locks. Memory-search neighbor probes reduce reliance on monotonic allocation. This remains a bounded heuristic: it does not establish a global performance optimum or prove numerical equivalence after quantization. NVIDIA telemetry is currently required. The staged search and manual-lock behavior have automated tests; a new full hardware tuning sweep was intentionally not run for this release because the owner requested reuse of saved settings.

When Start or a chat finds an existing server on the saved port, it automatically reuses it only if `/v1/models` advertises the exact saved model ID. The plugin never takes ownership of that process: Stop detaches, and saved launch changes require restarting the external server yourself. A different model, an invalid response, or an authenticated server without matching credentials is rejected. Strata tuning requires a plugin-owned server and never reuses an external process.

## Per-model reasoning settings

Edit a model profile to add/remove reasoning levels, give each a display name,
and set the exact `reasoning_effort` backend value. Choose a default level, or
Engine default to leave the request unspecified. Custom names and values are
supported; availability is declared per profile, not assumed for every model.
The engine/template must accept the configured backend values.

Qwen3.8 profiles start with Low → `low`, Medium → `medium`, and XHigh → `xhigh`,
with Medium as default. The conversation model picker uses these profile-owned
settings through DSH's existing adapter reasoning metadata. No DSH core patch
is required. An empty level list hides the reasoning selector for that profile.

## Model Scheduler integration

Optionally install `dsh-model-scheduler` for shared GPU admission, queued chat switching, manual load/unload and a configurable 30-second idle timeout. This provider remains independently usable. Scheduling policy lives in that separate Cordis service; no Harness core changes are required. Owned engine process groups are stopped before GPU release is reported. External servers are detached, never killed.

## Per-chat native KV checkpoints

Enabled by default for managed single-slot servers; turn it off in a profile’s KV checkpoints section. Checkpoints live under `<dataDir>/kv/chats/<hashed-session-id>/`, default `~/.dsh/dsh-strata/kv`. The latest native snapshot is kept for two model configurations per chat. Each successful model step saves the native slot to a private file, syncs it and atomically publishes its catalog entry before deleting the superseded snapshot. Failed saves preserve the last committed snapshot. Aborted/failed steps retain their earlier checkpoint. Auxiliary title/compaction calls do not replace a chat checkpoint.

Restores happen before generation, including after process restart. A new chat can restore the compatible snapshot with the longest matching system/message prefix; the engine validates its native format and computes the actual token prefix. Launch settings, model paths and file timestamps participate in compatibility checks. Restores never add old messages to a new conversation. Chat operations are serialized around restore/generate/save because the native API exposes slot 0. Large checkpoints require real disk/PCIe transfer time. Full OS power-loss testing has not been performed. Native parallel/batch mode does not support disk snapshots; its API reports that limitation and the card shows a KV warning. Externally managed servers are not checkpointed by this plugin.
