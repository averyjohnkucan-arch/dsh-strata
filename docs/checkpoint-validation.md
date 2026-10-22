# Checkpoint verification — 2026-10-21

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
