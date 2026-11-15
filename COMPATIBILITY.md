# DSH compatibility — 0.8.2

Reviewed on November 14, 2026 against DSH **0.2.2-rc.1**, Cordis **4.1.0** and Schemastery **3.19.0**. Dependency declarations and lockfiles target the current host instead of pulling in the older DSH/Cordis API generation.

Merged the locally installed Cores kept free setting, Qwen Medium defaults and Off support onto the newer 0.8 engine/migration code. CPU affinity covers server and tuner subprocesses; the saved reservation survives activation and runtime installation. Preserved native DeepSeek effort mapping and accepted saved Off selections.

DSH 0.2.2 declares Node 24.9 or newer. Compatibility checks cover the existing Node 22.22 installation as well as an isolated Node 24 runtime; the user’s system runtime was not changed. CI uses Node 24. Model servers, CUDA kernels and optional large model downloads are outside this source/API compatibility check; request serialization and scheduler tests use controlled local fixtures where appropriate.

The GitHub update does not replace an already-installed plugin automatically. Update the plugin through DSH to use this release, preserving its saved settings and model profiles.

The release workflow installs the checksum-pinned 0.8.0 runtime and builds from that verified runtime root. It no longer passes the old 0.5.0 archive to the current-runtime repackager.
