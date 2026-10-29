# Strata 0.6.3

DeepSeek profiles now expose their own native Thorough tuner through Auto-tune and Save and auto-tune. The unchanged upstream tuner and its helpers are included in the repository and plugin package. Successful DSpark/CPU-thread settings persist across restarts; failed or cancelled measurements keep the last saved settings. Activity shows native measured decode rates.

Qwen keeps its existing tuner. Strata engine binaries, model weights and vision support are unchanged. Existing profiles and caches remain in the plugin data directory when updating.
