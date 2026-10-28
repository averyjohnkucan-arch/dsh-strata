# Updating

Uninstall the previous plugin package, import the **0.5.3 release `.tgz`**, enable it, restart DSH and reload the Web page. Look for **Import files** and **Purge all cache** in Settings → Models. The release includes the runtime and Gyro L fork; source installs acquire the same runtime bundle when needed.

Profiles created by the 0.3/0.4 rebuild remain readable under `dsh-strata-v2`. The much earlier plugin used a different schema: import its original GGUF files again. Original weights are not copied or modified. Runtime changes invalidate prepared launch configurations; the upstream packer can reuse staged data.

Saving through the simplified editor clears legacy extra engine arguments and environment overrides. Select KV and context, then let Strata's Thorough tuner measure its settings. The included TQP engine is selected automatically for Gyro L. Existing explicit per-model runtime overrides remain readable.

Native SSD checkpoints live in the plugin's writable data directory, outside the installed package. Updating does not erase them, although a changed model, binary or configuration may make an older checkpoint ineligible for reuse. Purge all cache removes these files and unloads plugin models. It retains profiles, prepared packs, tuning presets, model weights and DSH history.

The bundled engines target the tested Linux x86-64 Blackwell sm_120 system. Both carry the documented optional-MTP checkpoint fix. See README and VALIDATION for cache precision limits and the exact checks performed.

0.5.1 adds Low, Medium, High and Uncensored presets for recognized original Flash-Next models. Unload and reload once after updating to preload the vector. Subsequent changes are per request. Existing context values are retained; choose Native to use the model's full declared context. Newly imported models use it by default.

0.5.2 uses separate Models, Files and Activity views. Settings replaces the model list and receives focus. Previously misclassified control-vector profiles are archived to component-profiles.json and shown under Components. The original vector files and real model profiles are retained.

0.5.3 resolves the projection from the included Control runtime, where the packaged asset actually lives. This fixes tuning and startup failures caused by the absent vendor/strata copy in npm packages. Missing assets fail before native launch. Tuner failures now show the native JSON reason, and stale progress files are cleared before a new run. Restart DSH after updating a linked folder.
