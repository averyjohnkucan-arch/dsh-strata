Self-contained Strata provider for DSH 0.2.1-rc.2.

0.5.3 fixes tuning/startup in installed packages by resolving the projection from runtime/control, validates the bundled asset during packaging, and surfaces native JSON tuning errors instead of an empty exit-code message.

The interface separates Models, Files and Activity. Per-model Settings opens a focused view with a Back button. Compact model rows keep Load and Settings visible; bulk tuning and logs appear only when needed. Control-vector GGUFs are classified as components, and old accidental vector profiles are archived without deleting original files.

Download the `.tgz` and import its local path in DSH. It includes Strata Control, portable Python, CUDA libraries, the GGUF helper and the Gyro L fork. Model weights are separate. No compiler or separate Strata installation is required.

Native context defaults, Low / Medium / High / Uncensored presets, Strata's Thorough tuner and 16 GiB per-model persistent SSD checkpoints remain available. High sends xhigh; Uncensored also enables the upstream experimental projection on compatible Flash-Next models. Mixed KV disk snapshots remain unsupported by the fork.

Target: Linux x86-64, NVIDIA Blackwell sm_120, CUDA 13 driver compatibility, glibc 2.43 or newer. Other GPUs and operating systems have not been validated. The compatible 0.5.0 runtime ABI and engines are unchanged. See README and docs/VALIDATION.md for test scope and limits.
