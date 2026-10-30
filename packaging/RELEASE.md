# Strata 0.7.0

Portable configs can now import prepared Flash-Next NVFP4 GPTQ and NVFP4/Q8 Mix packs. Import finds each component by exact byte size and MD5, restores the pack layout using links, and attaches its separate MTP runtime and selected vision projector. Dense-only GGUFs are no longer treated as complete standalone models. MTP settings recognize validated prepared packs even when their GGUFs omit the original model-name metadata.

Imported tuning settings remain active without automatic preset replacement. Portable CPU affinity applies to the whole server process tree on Linux. Imports of another KV variant reuse verified file identities during the plugin session; changed files are checked again.

The bundled runtime is unchanged. NVFP4 describes model weights here; this release does not add NVFP4 or FP8 KV. Stock Flash-Next serving uses MTP; DFlash2 remains CLI-only in the tested engine. Model weights stay in their original folders.
