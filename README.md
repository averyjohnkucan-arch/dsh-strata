# Strata for DSH

A local model provider for DeepSeek Harness. **0.5.0** includes its Strata runtime, native SSD conversation checkpoints and a **Purge all cache** button at the top of the provider card.

## Install

Requires DSH **0.2.1-rc.2** Web profile, Node **22.19+**, and `pnpm` on DSH's PATH. The included engines target **Linux x86-64, NVIDIA Blackwell sm_120, CUDA 13, glibc 2.43 or newer**. Other GPUs and operating systems have not been validated with this bundle.

Download the `.tgz` from [Releases](https://github.com/averyjohnkucan-arch/dsh-strata/releases), then enter its absolute local path in **Plugins → Add plugin**. Enable it and open **Settings → Models**. Strata, portable Python, CUDA libraries, the GGUF helper and the Gyro L fork are included. Model weights are separate. No compiler or separate Strata installation is needed.

The GitHub address is also accepted by DSH:

```text
https://github.com/averyjohnkucan-arch/dsh-strata
```

A source installation acquires the same verified release bundle from this repository when a runtime is first needed. Prefer the release archive for an offline installation. Updating an existing plugin requires uninstalling and reinstalling it, restarting DSH, then reloading the browser page. Profiles and original weights are retained in the plugin's data directory.

## Import models

1. Choose **Import files**, then select any shard or a folder. The host file picker works on the DSH machine, including mounted drives.
2. The importer recursively reads GGUF headers and groups shards. **Files and shards** lists complete models, incomplete sets, each file's purpose and its size. Original weights stay where they are.
3. A single vision projector under the model folder is selected automatically. Otherwise choose **Select mmproj file** or **Continue without vision**. Strata checks compatibility when loading.
4. Choose **KV precision (K / V)** and **Context**, then **Save and auto-tune**. Context increases by **32,768 tokens**, within the model's declared limit.
5. When tuning finishes, choose **Load** and select the model in DSH's conversation picker.

The KV choices are **FP16/FP16, FP16/Q8, Q8/Q8, Q8/Q5, Q5/Q5, Q5/Q4, Q4/Q4**. Unsupported choices are disabled. The importer never silently substitutes precision. The bundled TQP fork is selected automatically for Gyro L's TQP5/6/7 encodings; Gyro S uses the regular Strata engine. Explicit runtime overrides remain available under **Runtime compatibility**.

## Tuning and checkpoints

**Save and auto-tune** calls Strata's native **`tune auto --mode thorough`**. Strata owns the search, resource allocation and presets. The plugin adds model identity, context, KV, transport and projector paths. It does not set numeric worker, PCIe or prefill performance presets. Thorough tuning can take hours. Failed or cancelled tuning retains the previous result.

After a successful ordinary conversation answer, Strata writes its native session checkpoint to SSD. The plugin keeps **up to 16 GiB per model**, evicting the checkpoint with the oldest last-use time first. Files and last-use times survive process restarts and system reboots. On the first conversation after loading a model, its matching checkpoint is restored before generation. Strata checks model and cache identity; incompatible checkpoints are skipped. Its own RAM cache handles further conversations while that model stays loaded.

Disk checkpoints work with **FP16/FP16, Q8/Q8 and Q4/Q4** (and legacy Q8/Q4). The fork currently rejects mixed KV snapshots; the editor displays that limitation. An individual checkpoint larger than 16 GiB is not retained. Restoring KV avoids some repeated prompt processing; model weights still need loading into RAM/VRAM. No model-switch speed improvement is promised without a workload measurement.

**Purge all cache**, at the top of the provider card, waits for an active answer, stops loaded plugin models and removes the plugin-owned cache directory, including SSD checkpoints and native RAM caches. Model weights, prepared packs, profiles, tuning presets and DSH chat history are retained. A subsequent load rebuilds its caches.

## Runtime and storage

Regular Strata is based on **v0.2.7 / Control 0.1.52 / engine 0.1.52**. Both bundled engines include a small native checkpoint fix for models without an allocated MTP draft. Their source patches, upstream revisions, licenses and binary checksums are under `vendor/`. The Gyro L fork also includes its recorded TQP CPU changes. These engines were built for the tested sm_120 machine; HIP, SYCL, Windows and other CUDA architectures were not tested.

Local preparation supports `qwen4exp` Flash-Next and compatible `qwen35moe` GGUFs. Complete shards establish presence, not numerical compatibility. Engram/PLE, MTP, DFlash and vision components appear in the inventory. DFlash is inventoried only. Native Qwen uses embedded MTP; external native Qwen donors are unsupported. Existing explicit Flash-Next MTP configurations remain readable.

Data lives under **`$DSH_HOME/dsh-strata-v2`**, normally `~/.dsh/dsh-strata-v2`. `cache/checkpoints/<model-id>/` holds private session files. This writable plugin data is separate from its replaceable installed package, so updates do not erase checkpoints. The optional `dataDir` setting relocates it. Checkpoints contain conversation state; protect this directory as you would chat history. The host API uses DSH's authenticated owner connection, including after a plugin/server restart.

Packing and tokenizer extraction use vendored upstream tools. Shards are staged with symlinks; source weights are read-only. Upstream compatibility packing may convert dense tensors to BF16 and records the conversions.

## Development

- `client/`: provider card, file picker and compact settings; rebuild `client.js` after edits.
- `lib/`: adapter, lifecycle, checkpoints and workflow.
- `python/`: inspection, preparation and release installation.
- `vendor/`: pinned Control/helper sources, engine parts, patches and licenses.
- `packaging/`: verified, self-contained release packaging.

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm run check
pnpm test
```

The release workflow tests the wrapper and packages verified runtime inputs. GPU regressions and real-model validation are recorded separately in `docs/VALIDATION.md`; CI does not have a GPU. Building the browser bundle requires no access to model files.
