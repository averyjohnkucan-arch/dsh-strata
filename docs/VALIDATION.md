# Plugin 0.2.0 — stock Strata migration

Validated on Linux x86-64, NVIDIA RTX PRO 5000 Blackwell Laptop (sm_120), CUDA 13.1, 2026-10-26.

- Official v0.2.6 Control 0.1.51 and Qwen engine 0.1.50 archives downloaded and SHA-256 verified; private Python imports and engine version check passed.
- 51 Node tests: profiles, final launch arguments, feature gating, migration backup, stock preset integration, cancellation/lifecycle, native adapter, checkpoints and recommended downloads.
- 3 Python GGUF selection/import tests and 15 upstream stock preset tests passed.
- All 8 combinations of the three independent patch files apply cleanly to stock revision `4b9e05a2a806a3fe24f7b2560d98626c37dade35`.
- Combined optional CUDA engine built successfully. `model_family_test`, `kv_mixed_parity` and `kv_stream_parity` passed; streamed/resident and stage/DMA/graph comparisons passed for all additional KV formats. `conversation_validation_test` passed 996 host-only checks.
- External-MTP compatibility checker passed six synthetic cases: compatible donor, incompatible geometry, reordered tokenizer, different control token, already-embedded target and missing donor draft.
- Each of the six existing Strata profiles generated a valid stock configuration using the real official preset helper, in a temporary data directory. Original live profiles were not changed by that check.
- Package contents checked for engine scripts, metadata, catalogs, patch files and licenses; local engines, model weights and credentials are not shipped.

Limits: no fresh full-model quantization-quality benchmark, long-context speed qualification or completed 20-minute/two-hour auto-tune sweep is claimed. Qwen INT8 kernels compile in the combined build; model-level numerical quality remains to be evaluated. The settings UI has syntax/integration checks but was not visually revalidated in a running DSH browser for this release. HIP/SYCL/Metal extension builds are untested. Stock defaults keep extensions off.

---

# Earlier release validation (historical)

# Validation for v0.1.0

- Host and Client JavaScript syntax checks.
- Profile persistence, multiple models, deleting a profile without deleting model files.
- Native argv construction and reproduction of the supplied NInfer launch flags.
- Owned subprocess readiness and termination; external attachment detaches without terminating its server.
- Local streaming through the public DSH PiAiAdapter, with usage and DSH attribution.
- Packed installation in a clean DSH 0.2.1-rc.2 Web profile without dependency build scripts.
- Both cards rendered in the real DSH Models settings; existing model profiles visible.
- Strata: manual tuning locks, staged search / 5% decode constraint under deterministic evaluator tests, GGUF classification and incomplete/ambiguous selections.
- Strata: real 33-shard Atomic Q5 selection and projector identification; source profiles retained exact argument order and existing referenced paths.
- NInfer: pinned OCI manifest and presence of expected runtime layer verified against the registry.

Not performed: new full-model inference, new GPU tuning, repeated calibration, clean-machine compiler/runtime installation on every platform, or numerical parity after quantization. Existing saved tunes were imported as requested. Supported platform and format limits are in README.md.
