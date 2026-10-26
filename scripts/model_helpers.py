"""Local import helpers; no dependency on an engine fork."""
from pathlib import Path
import re, struct

def split_paths(first):
 first=Path(first);m=re.search(r'-(\d{5})-of-(\d{5})\.gguf$',first.name)
 paths=[first] if not m else [first.with_name(first.name[:m.start()]+f'-{i:05}-of-{int(m[2]):05}.gguf') for i in range(1,int(m[2])+1)]
 missing=[str(p) for p in paths if not p.is_file()]
 if missing:raise FileNotFoundError('Missing GGUF shards: '+', '.join(missing))
 return paths

def make_profile(path,layers,experts):
 # Documented STRP v1 profile format: interleave layers for uniform initial residency.
 pairs=[(layer,expert) for expert in range(experts) for layer in range(layers)]
 ranks={pair:rank for rank,pair in enumerate(pairs)}
 data=b'STRP'+struct.pack('<5I',1,layers,experts,len(pairs),len(pairs))
 data+=b''.join(struct.pack('<2H',*pair) for pair in pairs)
 data+=b''.join(struct.pack('<i',ranks[layer,expert]) for layer in range(layers) for expert in range(experts))
 Path(path).write_bytes(data)
