# Checkpoint verification — 2026-10-21

Version 0.1.5 additionally covers own-chat system/tool edits in a regression
test. A matching model checkpoint from that chat remains eligible for native
token-prefix validation when the logical system/tool hash changes. Cross-chat
reuse still requires a matching logical prefix. All 30 plugin tests pass.

RTX PRO 5000 Blackwell laptop GPU; Atomic Q5 Turbo; 32,768-token context; local Strata source `e76d4c3d8e25bde81a1333f3f4254ffc5c00d035`. These are individual correctness-test measurements while an unrelated CUDA build and CPU background work were running, not a throughput benchmark.

| Operation | Measured time | Native cache reuse |
|---|---:|---:|
| Initial prompt | 9.227 s to first token | 0 tokens |
| Uninterrupted continuation | 0.712 s to first token | 3,411 tokens |
| Continuation after disk restore | 0.744 s to first token | 3,411 tokens |
| New chat after restoring shared prefix | 1.077 s to first token | 3,389 tokens |
| Same new chat after cold restart | 3.700 s to first token | 0 tokens |

The 332,237,064-byte test snapshot saved in 0.718 s. Restore took 0.862 s wall time. Model startup is excluded; loading the weights took about a minute on this machine.

The continuation after a full server restart matched uninterrupted greedy output. The new chat reused only its shared prefix, and its answer matched a second cold-server run. The original and plugin-prepared Qwen templates produced byte-identical normal prompts for generation on/off and thinking on/off. The copied template permits the native system-only prefix-rendering pass.

Plugin tests: 29 passed. No DSH or original model/tokenizer files were edited.

## Independent default-prefix checkpoint — 0.1.7

A system/tool-only seed (with a blank synthetic user message and one discarded token required by the native API) is persisted independently of private chat checkpoints. The base contains no real user/assistant history. Its native shared prefix ends before the real user message. A changed model/system/tool/rendering setup gets its own base; a resumed chat prefers its latest private step.

On Atomic Q5 Turbo at 32K allocation, the independent base took 2.981 s to build once and occupied 324,012,048 bytes. After an engine restart and deletion of the private test-chat snapshot, a fresh chat reused 3,107 tokens. Its complete short response took 0.932 s after restoration; a second cold restart took 7.560 s, with identical greedy output. Request times exclude weight loading and disk restore. A second save replaced the preceding step snapshot.

All 35 plugin tests pass. They cover seed isolation, persistence after chat deletion, prompt/tool changes, failed and cancelled seeds, latest-chat precedence, and late callbacks after adapter disposal. A real reload exposed a disposed-registration callback in the old plugin; shutdown now stops route notifications, clears the owned registration and tolerates DSH disposing its handle first. No Harness files were changed.
