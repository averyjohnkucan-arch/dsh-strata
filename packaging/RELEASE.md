# Strata 0.6.4

Strata now cooperates with the optional dsh-model-scheduler for GPU handoff with NInfer and other registered providers. A request holds its shared lease through generation and checkpoint saving; native tuning reserves the same GPU. The settings card shows whether shared scheduling is active.

Native startup failures now report a concise reason and competing GPU usage, preserving full diagnostics in a private startup.log. Failed loads and cancelled queued requests release admission safely for retries. The Strata engine, native memory sizing, context and KV settings are unchanged.

Install dsh-model-scheduler separately and restart DSH to enable shared handoff. Without it, unload another provider's model before starting Strata on the same GPU.
