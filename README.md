# Strata for DSH

A local model provider for DeepSeek Harness. **0.6.0** identifies built-in MTP and supports selecting or automatically preparing a separate Flash-Next MTP runtime. It automatically downloads the verified Strata runtime after a GitHub installation. It separates Models, Files and Activity into focused views. Each model has a Settings view that opens in place, with Load beside it. Strata supports native SSD checkpoints and a top-level Purge all cache button.

## Install

Requires DSH **0.2.1-rc.2** Web profile, Node **22.19+**, and `pnpm` on DSH's PATH. The included engines target **Linux x86-64, NVIDIA Blackwell sm_120, CUDA 13, glibc 2.43 or newer**. Other GPUs and operating systems have not been validated with this bundle.

Download the `.tgz` from [Releases](https://github.com/averyjohnkucan-arch/dsh-strata/releases), then enter its absolute local path in **Plugins → Add plugin**. Enable it and open **Settings → Models**. Strata, portable Python, CUDA libraries, the GGUF helper and the Gyro L fork are included. Model weights are separate. No compiler or separate Strata installation is needed.

The GitHub address is also accepted by DSH:

```text
https://github.com/averyjohnkucan-arch/dsh-strata
```

A GitHub source installation automatically downloads and verifies the runtime from this repository when the plugin is enabled. Progress appears in the Strata card; if it fails, use Retry installation. Prefer the release archive for an offline installation. Updating an existing plugin requires uninstalling and reinstalling it, restarting DSH, then reloading the browser page. Profiles and original weights are retained in the plugin's data directory.

## Import models

1. Choose **Import files**, then select any shard or a folder. The host file picker works on the DSH machine, including mounted drives.
2. The importer recursively reads GGUF headers and groups shards. **Files** lists complete models, incomplete sets, each file's purpose and its size. Original weights stay where they are.
3. A single vision projector under the model folder is selected automatically. Otherwise choose **Select mmproj file** or **Continue without vision**. Strata checks compatibility when loading.
4. Choose **KV precision (K / V)** and **Context**, then **Save and auto-tune**. Context defaults to **Native**, using the model's declared GGUF context. Smaller choices remain available in **32,768-token increments**. Saved explicit choices are retained.
5. When tuning finishes, choose **Load** and select the model in DSH's conversation picker.

The KV choices are **FP16/FP16, FP16/Q8, Q8/Q8, Q8/Q5, Q5/Q5, Q5/Q4, Q4/Q4**. Unsupported choices are disabled. The importer never silently substitutes precision. The bundled TQP fork is selected automatically for Gyro L's TQP5/6/7 encodings; Gyro S uses the regular Strata engine. Explicit runtime overrides remain available under **Advanced**.

Control-vector GGUFs appear under **Files → Components**, never as loadable models. Earlier accidental vector profiles are preserved in `component-profiles.json` and removed from model routes; original GGUF files are untouched. **Select** reveals bulk tuning controls. Logs remain under **Activity**.

## Thinking presets

The conversation selector offers **Low**, **Medium**, **High** and, for compatible original Flash-Next models, **Uncensored**. The native requests are `low`, `medium`, `xhigh`, and `xhigh` with the bundled experimental refusal-direction projection enabled. Ordinary choices explicitly disable projection. The vector loads once with the model; switching presets applies to the next request without a model reload. Each compatible request includes a current-mode runtime notice, so the assistant can distinguish the new setting from earlier replies. Changing projection also changes this prompt suffix; the prior conversation text remains available. Native KV state is separated by projection mode, and SSD checkpoint names are partitioned by it.

The projection came unchanged from upstream Strata, not from this plugin's author. It is a model-specific experiment, not a guarantee that every refusal disappears. Disabling it does not undo changes already baked into an abliterated model. See [projection provenance and behavior](docs/PROJECTION.md).

## Tuning and checkpoints

**Save and auto-tune** calls Strata's native **`tune auto --mode thorough`**. Strata owns the search, resource allocation and presets. The plugin adds model identity, context, KV, transport and projector paths. It does not set numeric worker, PCIe or prefill performance presets. Thorough tuning can take hours. Failed or cancelled tuning retains the previous result.

After a successful ordinary conversation answer, Strata writes its native session checkpoint to SSD. The plugin keeps **up to 16 GiB per model**, evicting the checkpoint with the oldest last-use time first. Files and last-use times survive process restarts and system reboots. On the first conversation after loading a model, its matching checkpoint is restored before generation. Strata checks model and cache identity; incompatible checkpoints are skipped. Its own RAM cache handles further conversations while that model stays loaded.

Disk checkpoints work with **FP16/FP16, Q8/Q8 and Q4/Q4** (and legacy Q8/Q4). The fork currently rejects mixed KV snapshots; the editor displays that limitation. An individual checkpoint larger than 16 GiB is not retained. Restoring KV avoids some repeated prompt processing; model weights still need loading into RAM/VRAM. No model-switch speed improvement is promised without a workload measurement.

**Purge all cache**, at the top of the provider card, waits for an active answer, stops loaded plugin models and removes the plugin-owned cache directory, including SSD checkpoints and native RAM caches. Model weights, prepared packs, profiles, tuning presets and DSH chat history are retained. A subsequent load rebuilds its caches.

## Runtime and storage

Regular Strata is based on **v0.2.7 / Control 0.1.52 / engine 0.1.52**. Both bundled engines include a small native checkpoint fix for models without an allocated MTP draft. Their source patches, upstream revisions, licenses and binary checksums are under `vendor/`. The Gyro L fork also includes its recorded TQP CPU changes. These engines were built for the tested sm_120 machine; HIP, SYCL, Windows and other CUDA architectures were not tested.

Local preparation supports `qwen4exp` Flash-Next, compatible `qwen35moe` GGUFs and native-catalog `deepseek41` shard sets. Complete shards establish presence, not numerical compatibility. Engram/PLE, MTP, DFlash and vision components appear in the inventory. DFlash is inventoried only. Native Qwen loads embedded MTP, but Strata's native engine drafts only for greedy requests without sampling or penalties. It uses the native engine's FP32 KV format; external native Qwen donors are unsupported. Existing explicit Flash-Next MTP configurations remain readable.

Flash-Next requires a separate prepared Strata MTP directory containing `experts.bin`, `dense.bin`, `dense.txt`, and `draft_vocab.bin`. Import attaches an unambiguous discovered runtime; otherwise Strata fetches its approximately 5 GB draft from the original checkpoint and prepares a shared runtime on first use. To avoid that download, choose an existing prepared MTP folder in the model's settings. Raw MTP GGUFs from other converters are not automatically interchangeable with this runtime format. Changing MTP invalidates the previous model-specific tuning result.

Data lives under **`$DSH_HOME/dsh-strata-v2`**, normally `~/.dsh/dsh-strata-v2`. `cache/checkpoints/<model-id>/` holds private session files. This writable plugin data is separate from its replaceable installed package, so updates do not erase checkpoints. The optional `dataDir` setting relocates it. Checkpoints contain conversation state; protect this directory as you would chat history. The host API uses DSH's authenticated owner connection, including after a plugin/server restart.

Packing and tokenizer extraction use vendored upstream tools. Shards are staged with symlinks; source weights are read-only. Upstream compatibility packing may convert dense tensors to BF16 and records the conversions.

## Development

- `client/`: provider card, file picker and compact settings; rebuild `client.js` after edits.
- `lib/`: adapter, lifecycle, checkpoints and workflow.
- `python/`: inspection, preparation and release installation.
- `vendor/`: pinned Control/helper sources, engine metadata, patches and licenses. Engine binaries are in the pinned release runtime.
- `packaging/`: verified, self-contained release packaging.

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm run check
pnpm test
```

The release workflow tests the wrapper and packages verified runtime inputs. GPU regressions and real-model validation are recorded separately in `docs/VALIDATION.md`; CI does not have a GPU. Building the browser bundle requires no access to model files.

## Portable model configs

Open a model’s **⋯ → Export config JSON** menu. Each model shard, selected vision projector and selected MTP runtime piece is identified by its exact byte size and full-file MD5. Hashing large weights takes time; Activity shows progress and offers **Download config JSON** when complete. Model weights are not exported.

Choose **Import config**, select the JSON, and enter the folder to search. Subfolders are searched by size first, then MD5. The plugin links matching files into a private layout and creates a new model profile, so filenames and drive locations can change without copying weights. Native binaries, credentials and machine-specific runtime paths are excluded. Supported saved tuning flags are retained; run Thorough tuning again after changing hardware.

Prepared Flash-Next NVFP4 GPTQ and NVFP4/Q8 Mix configs include the expert pack, dense weights, tokenizer, PLE table, embeddings and separate MTP runtime. The importer restores the pack layout instead of trying to repack its dense GGUF as a complete model. Selected vision projectors are included in the manifest too. Imported tuning stays in effect without automatic preset replacement; an exported CPU set applies to the whole server process tree on Linux.

NVFP4 weight precision is separate from KV precision. The stock Flash-Next engine supports FP16 and Q8 KV, but does not offer FP8 or NVFP4 KV. DFlash components can be inventoried; the tested stock runtime serves Flash-Next using MTP, not DFlash2.

The Strata engine is unchanged. Qwen 3.6 remains FP32 KV with embedded MTP only; its settings explain these native limitations.

During auto-tuning, the Models and Activity views show **Prefill** and **Decode** in tokens per second from the latest completed native measurement. Rates refresh as trial logs arrive; pending measurements show “Measuring…”. These are live trial samples, not the final aggregate tuning score.

Rename a saved model under **Settings → Model name → Save**. The saved name appears in the model list and DSH model picker. Renaming preserves its model files, profile identity and saved tuning.

## DeepSeek 1017 auto-tuning

For a prepared DeepSeek profile, choose **⋯ → Auto-tune DeepSeek** or **Settings → Save and auto-tune**. The DeepSeek download flow exposes the same native-tuning option after setup. DeepSeek calls its own Thorough tuner, not the Qwen preset tuner. It measures DSpark and CPU-thread choices, keeps the native tuner’s greater-than-5% acceptance rule, and preserves your selected context and automatic RAM-store sizing. Activity shows its measured decode rate; this tuner does not measure prefill.

The exact tuner is included at `vendor/gyro-l-control/tools/dsv41/tune.py` with its tokenizer/smoke helpers and upstream license/provenance. Its SHA-256 is `bb75873d33774cc5d27525e4af0693eb9d6cb2a72dc9d92c50426d3651b1fab0`, matching the pinned Control 0.1.52 tool. No tuner download or manual script path is needed.

Successful settings and the measurement report are saved in the model profile and reused after restarting DSH. Failed/cancelled measurements preserve the last saved configuration. An exit code of zero alone is not considered a successful tune. DeepSeek saves launch arguments rather than a Qwen preset ID. Updating the plugin preserves existing profiles; the engine, vision support and model weights are unchanged. Local DeepSeek GGUF preparation remains separate from the Qwen importer; DeepSeek profiles from Strata’s download/setup flow carry the required prepared configuration.

## Switching between local providers

For shared GPU handoff, install [dsh-model-scheduler](https://github.com/averyjohnkucan-arch/dsh-model-scheduler) and restart DSH. Strata and NInfer register with that optional service; it queues competing requests and unloads the previous cooperating model before loading the next one. Strata holds its lease through generation and checkpoint saving, and native auto-tuning reserves the same GPU. The Strata card says **Shared GPU scheduler** when connected.

Without that plugin, the card says **Independent GPU queue**. Strata serializes its own requests, but does not unload another provider's server. Finish the other answer and unload that model before loading Strata on the same GPU. Neither mode kills unknown GPU processes. Context, KV precision and native engine memory sizing remain unchanged.

A failed native startup now reports a short reason and, for allocation failures, GPU usage captured before loading. Full startup output is kept privately at `models/<profile-id>/startup.log` in Strata's data directory. Failed or cancelled startup releases admission so the next request can retry.

## Importing local DeepSeek 4.1 Flash

Import a folder containing a complete native Strata set: IST-DAS IQ1_M, IQ2_XXS or IQ2_XS, or Unsloth UD-Q8_K_XL, using the publisher filenames (upstream legacy names are also accepted). Nearby Engram, DSpark and metadata files are reused. Strata's unchanged native setup verifies hashes, acquires its separate official DeepSeek engine, creates the pack and writes its own launch settings. Missing companion files are acquired by that native flow. Existing model weights are linked into plugin staging rather than copied.

The first hash check can take several minutes for hundreds of GB. A failed or cancelled setup leaves the saved profile unprepared and can be retried; source weights are never removed. The old cached “local preparation unavailable” warning no longer blocks existing DeepSeek profiles. Re-importing is optional after updating: the existing saved model can be loaded again.

DeepSeek owns its KV representation and DSpark automatic policy. The editor does not show Qwen KV controls for it. This local path is text only; it does not attach Flash Next mmproj files. Its context selection is preserved and the native setup validates the supported range. File preparation skips the separate GPU smoke process so an Import/Prepare operation cannot collide with another provider; the subsequent scheduled model load validates readiness through the actual DeepSeek engine. Native auto-tuning remains available after preparation.

DeepSeek uses its own persistent slot cache under `cache/deepseek/<profile-id>`, with a 16 GiB native slot budget by default. The plugin does not send Qwen's explicit SAVE/RESTORE protocol to that engine. Purge all cache covers the default DeepSeek slot directory as well.

## Shared DeepSeek engine (0.6.6)

Every managed DeepSeek profile uses one official runtime under `runtime/deepseek/engine-dsv41` in the plugin data directory. The first use checks existing per-profile installations and migrates a valid signed package through Strata's native installer. It copies the runtime into the shared location, preserves the original, and does not fetch it again. Only when no usable runtime exists does the native signed-feed downloader run; all profiles then share that resumable download. Installation is locked across bridge processes.

Existing prepared profiles switch to the shared runtime when next loaded or tuned. Model paths, prepared packs, contexts and tuning results stay profile-specific. Explicit custom runtime overrides are preserved. Moving/copying GGUF files or adding another profile does not require downloading another engine. Changing weight files may still require native verification and packing.

Tuning reports **Preparing model**, then **Waiting for GPU**, then measurement. Preparation uses CPU/disk and does not reserve the GPU. Token rates appear only when the measurement stage starts.

See [COMPATIBILITY.md](COMPATIBILITY.md) for supported DSH versions and upgrade checks.
