# Stock Strata migration (plugin 0.2.0)

## What changed

The default runtime now uses the verified official v0.2.6 release instead of Strata Unleashed. Stock auto-tune replaces the plugin's former custom tuner. The plugin does not edit DSH core; installation uses `dsh.bundle.patch`, the model provider uses `ctx.llm.registerAdapter`, and the settings card uses `settings.models.footer`. Process teardown and registrations are owned by Cordis lifecycle hooks.

Profiles are backed up before migration. Fork runtime paths, launch options and precision choices remain in the backup and `legacyEngine`. Qwen35 profiles switch to stock FP32 KV, full residency and embedded MTP; old snapshot, sampled-draft and GQA flags are removed. Flash-Next fork-only KV pairs switch to stock Q8/Q8. Existing model files and independently managed native servers are retained.

## Feature boundaries

NVFP4 routed-expert weights are stock functionality. Q6/Q5 mixed KV, Qwen INT8 KV and an external Qwen donor are separate optional patches, all disabled initially. Unsupported combinations are rejected, including those introduced through advanced argv or an active preset. Turning on an extension requires a local CUDA build and validation before activation.

The official CUDA runtime needs no compiler. Optional extensions require CMake 3.24+, a C++20 compiler and CUDA toolkit. They use the pinned upstream GGML dependency and an explicit GPU architecture so Blackwell's native FP4 unit receives the appropriate architecture suffix. No administrator package installation is attempted.

This plugin's automatic importer covers Flash-Next and Qwen3.6 35B A3B. The separate stock DeepSeek V4.1 runtime is outside this migration. Qwen disk checkpoints remain unsupported, and mixed Flash-Next formats must disable disk checkpoints, parked conversation cache and elastic KV growth.

## Tuning and checkpoints

Upstream controls the auto-tune search, preset validity and speed/room goals. Legacy plugin locks are not advertised as overriding upstream presets. A user can disable preset application for manual settings. Checkpoint identity includes the effective preset arguments/environment/sampling so an incompatible preset cannot restore the old serialized KV state.

## Validation scope

See VALIDATION.md for this release's checks. Kernel tests and profile migration tests are not a fresh model-quality or speed benchmark. Optional quantization can alter output; tune and evaluate the selected model before relying on it.
