# Strata 0.6.0

Adds portable JSON model configuration export/import. Required pieces are matched recursively by exact size and MD5, including model shards, vision projectors and separate MTP runtimes. Original weights stay in place. Selected model settings and supported tuning flags are retained.

The bundled Strata engine is unchanged. Qwen 3.6 settings explain its fixed FP32 KV and embedded-MTP requirement.
