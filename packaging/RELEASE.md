Self-contained Strata model provider for DSH 0.2.1-rc.2.

Download the `.tgz` below and import its local path in DSH's plugin installer. It includes Strata Control, portable Python, CUDA libraries, the pinned GGUF helper and the Gyro L fork. Model weights are supplied separately.

Target: Linux x86-64, NVIDIA Blackwell sm_120, driver compatible with CUDA 13, glibc 2.43 or newer. Other GPUs and operating systems have not been validated. Both engines include the recorded native checkpoint fix for models without MTP; regular Strata otherwise uses v0.2.7 sources.

Native SSD conversation checkpoints retain up to 16 GiB per model across restarts and reboots. Oldest last-used checkpoints are evicted first. Mixed KV snapshots are unsupported by the current fork. A single Purge all cache button is at the top of the provider card. Strata owns tuning and RAM caching.

No separate Strata installation, Python package installation or compiler is required. See README and docs/VALIDATION.md for usage and test limits.
