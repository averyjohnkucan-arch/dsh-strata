# Projection provenance and behavior

The bundled file is `data/experimental-speed-projection/Qwen3.8-Flash-Next-experimental-speed-projection.gguf` from [official Strata v0.2.7](https://github.com/Niko1221/Strata/blob/v0.2.7/data/experimental-speed-projection/README.md), included unchanged in its Control 0.1.52 archive. Both copies have SHA-256 `ef0724c5b79297e481017be85769832bc26eb220c984ecba2b0e1b0c8426312b`. The plugin did not create or train it. Upstream says it was derived from original Qwen3.8-Flash-Next activations and is covered by that model's Qwen Community License 1.0. Its JSON references a `cvec-hooks` branch in Cudila/llama.cpp; that reference alone does not establish who authored the vector.

Upstream calls it an experimental refusal-direction projection. It removes a specified direction from the residual stream after layers 4–44. It also changes ordinary predictions. It is not a faster engine kernel, a thinking level, or a promise that the model will answer every request.

The engine must load the vector at model startup. Once loaded, the documented request field `experimental_speed_projection` switches its application on or off for the next request. The plugin preloads it only for recognized original Flash-Next models and defaults ordinary requests to off. Swift and other architectures do not receive the Uncensored choice. Native loading still checks the vector geometry.

| DSH label | Native reasoning_effort | Projection |
| --- | --- | --- |
| Low | low | false |
| Medium | medium | false |
| High | xhigh | false |
| Uncensored | xhigh | true |

The default is High. Changing the choice does not interrupt an answer already running. Native Strata prevents reusing KV from the opposite projection mode, and the plugin separates their SSD filenames. Model weights are unchanged. Turning projection off restores the model's own ordinary inference path; it cannot undo an abliteration already baked into a model such as an abliterated HuiHui variant.

Existing installed models need unloading and loading once after this plugin update so the vector is available. Subsequent preset changes need no reload. Context defaults to the native GGUF value for new imports; an existing saved context is retained until the user chooses Native.

Version 0.5.12 adds a factual runtime notice to each compatible request. DSH effort-only changes do not generate its normal model-switch notice, so the adapter explicitly identifies the current projection state. The notice is rebuilt from the current request and is not appended to stored history. Low, Medium and High use identical projection-off notices; only switching projection on or off changes the notice. Switching changes the prompt suffix as well as the native projection flag. It does not rewrite earlier assistant replies or guarantee a change in refusal behavior.
