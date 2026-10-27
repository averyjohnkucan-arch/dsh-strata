# Strata for DSH

A small local model provider for DeepSeek Harness. Version **0.4.0** adds a working host file picker and simpler model settings.

## Install or update

Requires DSH **0.2.1-rc.2**, its Web profile, Node **22.19+**, and `pnpm` on DSH's PATH.

In **Plugins → Add plugin**, enter:

```text
https://github.com/averyjohnkucan-arch/dsh-strata
```

For an existing GitHub installation, uninstall the old plugin and reinstall from that address, then restart DSH and reload its browser page. Look for **Strata 0.4.0 → Import files** in **Settings → Models**. The old “Select model files” dialog belongs to an earlier version. The shipped browser bundle needs no build step.

An unpacked local directory or package `.tgz` can also be imported. Keep a linked local directory in place. Profiles and original weights survive removal of the plugin package.

## Import your models

1. Choose **Import files**. Open a folder and select any model shard, or import the whole folder.
2. The plugin reads GGUF headers, finds sibling shards recursively, and adds complete model sets. Missing or conflicting shards appear under **Files and shards**, with each file's purpose and size. Weights stay where they are.
3. A single vision projector in the model's folder tree is detected automatically. If none is found, or there are several candidates, choose **Select mmproj file** or **Continue without vision**. Strata still checks model/projector compatibility when it loads them.
4. Choose **KV precision (K / V)** and **Context**, then **Save and auto-tune**. Context choices increase by **32,768 tokens**, within the context declared in the model header. Existing saved context values remain readable.
5. When tuning finishes, choose **Load**, then select the model in DSH's conversation picker.

The KV dropdown contains **FP16/FP16, FP16/Q8, Q8/Q8, Q8/Q5, Q5/Q5, Q5/Q4, Q4/Q4**. Choices unavailable in the installed engine are disabled. Ordinary FP16, Q8 and Q4 pairs map to Strata's corresponding native arguments; other pairs are passed unchanged. A fork supporting mixed KV pairs is needed for formats absent from the official engine. The plugin does not substitute another precision silently.

The file picker operates on the DSH host, including mounted drives. It lists folders and GGUF files directly, shows errors, and supports entering a folder path. It never uploads model weights through the browser.

## Strata owns tuning

**Save and auto-tune** calls **`strata tune auto --mode thorough`**. Strata owns the search, resource policy, performance settings and saved presets. The plugin does not inject worker counts, PCIe fractions, numeric prefill sizes or tuning goal/RAM overrides. Native IQ packs require an enabled prefill path and a verifier window of at least two tokens. The adapter enables those paths, requests Strata’s automatic prefill/cache allocation, and gives the tuner that valid baseline. Saving from the simplified editor clears legacy extra engine arguments and environment overrides. Model identity, selected context/KV, transport and projector paths are the plugin's inputs.

A tuning run succeeds only when Strata confirms a usable saved preset. Failed or cancelled runs preserve the previous result. Changing context or KV clears the displayed tuning result; Strata's own preset resolver matches the new inputs. Models tune one at a time. Thorough runs can take hours and use the GPU.

## Runtime and compatibility

**Strata runtime** holds installation and path controls. Automatic installation targets Linux x86-64 NVIDIA and pins official **Strata v0.2.7 / Control 0.1.52 / engine 0.1.52**, with SHA-256 verification. It installs privately; existing runtime directories are retained. **Download a model** uses Strata's own catalog and setup program.

Local preparation supports `qwen4exp` Flash-Next and compatible `qwen35moe` GGUFs. Complete shards establish file presence, not numerical compatibility or quality. Unsupported architectures and tensor encodings produce explicit errors.

Gyro L needs a compatible TQP5/6/7 fork. In its collapsed **Runtime compatibility** section, enter that fork's Control directory and engine executable and enable its TQP support. Leave Gyro S's paths empty to use regular Strata. Fork selection is per model. The plugin does not download or patch an arbitrary fork automatically.

The inventory includes Engram/PLE, MTP, DFlash and vision components. Embedded tensors stay with their model's shard set. Unrelated sidecars are not attached automatically. DFlash is inventoried only; this importer does not attach a DFlash drafter. Native Qwen uses its embedded MTP; external native Qwen donors are unsupported. Existing explicit Flash-Next MTP profiles remain readable.

Packing and tokenizer extraction use upstream Strata tools. Canonical shard names are staged with symlinks in private storage. Source weights are opened read-only. The upstream compatibility packer may convert dense tensors to BF16; its report records conversions.

## Storage and development

Profiles, packs, runtime downloads and presets live under `$DSH_HOME/dsh-strata-v2` (normally `~/.dsh/dsh-strata-v2`). The optional plugin `dataDir` changes that location. Disabling the plugin stops its owned processes and jobs. Its host API requires a per-load owner capability.

- `client/`: model card, host file picker and compact settings.
- `lib/`: DSH adapter, workflow, settings, jobs and process ownership.
- `python/`: GGUF inspection, shard grouping, verified runtime installer and upstream bridge.
- `client.js`: generated browser bundle; edit `client/` and rebuild.

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm run check
pnpm test
```

Tests cover shard grouping, incomplete sets, selected-file import, projector ambiguity, host browsing, KV mapping, context steps, native tuning dispatch, HTTP streaming and process cleanup. GPU generation benchmarks and completed optimization sweeps are separate from these checks.
