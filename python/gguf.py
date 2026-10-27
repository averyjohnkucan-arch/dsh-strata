"""Inspect GGUF headers without mapping or reading model weights."""

from collections import Counter
from pathlib import Path
import os
import re
import struct

FORMATS = {
    0: "B",
    1: "b",
    2: "H",
    3: "h",
    4: "I",
    5: "i",
    6: "f",
    7: "?",
    10: "Q",
    11: "q",
    12: "d",
}
MAX_HEADER = 128 * 1024 * 1024
SHARD = re.compile(r"^(.*)-(\d{5})-of-(\d{5})\.gguf$", re.I)


class Reader:
    def __init__(self, stream, size):
        self.stream, self.size = stream, size

    def take(self, size, skip=False):
        if size < 0 or self.stream.tell() + size > min(self.size, MAX_HEADER):
            raise ValueError("Truncated or oversized GGUF header")
        if skip:
            self.stream.seek(size, os.SEEK_CUR)
            return None
        data = self.stream.read(size)
        if len(data) != size:
            raise ValueError("Truncated GGUF header")
        return data

    def number(self, fmt):
        return struct.unpack("<" + fmt, self.take(struct.calcsize(fmt)))[0]

    def string(self, capture=True):
        size = self.number("Q")
        if size > 16 * 1024 * 1024:
            raise ValueError("GGUF string exceeds inspection limit")
        data = self.take(size, skip=not capture)
        return data.decode("utf-8") if capture else None

    def value(self, kind, capture=False):
        if kind == 8:
            return self.string(capture)
        if kind == 9:
            subtype, count = self.number("I"), self.number("Q")
            if count > 2_000_000:
                raise ValueError("GGUF array exceeds inspection limit")
            if subtype == 8:
                for _ in range(count):
                    self.string(False)
            elif subtype in FORMATS:
                self.take(struct.calcsize(FORMATS[subtype]) * count, skip=True)
            else:
                raise ValueError("Unsupported GGUF array type")
            return None
        if kind not in FORMATS:
            raise ValueError("Unsupported GGUF metadata type")
        return self.number(FORMATS[kind])


def tensor_role(name):
    name = name.lower()
    if (
        "engram" in name
        or "ngram" in name
        or "per_layer_token_embd" in name
        or "ple_" in name
    ):
        return "Engram"
    if "dflash" in name or "draft" in name:
        return "Draft"
    if "nextn" in name or "mtp" in name:
        return "MTP"
    if name.startswith(("v.", "vision.", "mm.", "clip.")):
        return "Vision"
    if "exps" in name or "experts" in name:
        return "Experts"
    if "token_embd" in name or "embed_tokens" in name:
        return "Embeddings"
    return "Model"


def inspect(path):
    path = Path(path)
    size = path.stat().st_size
    with path.open("rb") as stream:
        r = Reader(stream, size)
        if r.take(4) != b"GGUF" or r.number("I") not in (2, 3):
            raise ValueError("Expected a GGUF v2/v3 file")
        tensors, keys = r.number("Q"), r.number("Q")
        if tensors > 200_000 or keys > 20_000:
            raise ValueError("GGUF directory exceeds inspection limit")
        metadata = {}
        for _ in range(keys):
            key = r.string()
            capture = key.startswith(("general.", "split.")) or key.endswith(
                (".context_length", ".block_count", ".expert_count", '.nextn_predict_layers')
            )
            value = r.value(r.number("I"), capture)
            if capture:
                metadata[key] = value
        roles = Counter()
        encodings = Counter()
        offsets = []
        for _ in range(tensors):
            name = r.string()
            dimensions = r.number("I")
            if not 1 <= dimensions <= 8:
                raise ValueError("Invalid tensor dimensions")
            shape = [r.number("Q") for _ in range(dimensions)]
            if any(n == 0 for n in shape):
                raise ValueError("Invalid tensor shape")
            encodings[r.number('I')] += 1
            offsets.append(r.number("Q"))
            roles[tensor_role(name)] += 1
        alignment = metadata.get("general.alignment", 32)
        if (
            type(alignment) is not int
            or alignment < 1
            or alignment > 4096
            or alignment & (alignment - 1)
        ):
            raise ValueError("Invalid tensor alignment")
        payload = (stream.tell() + alignment - 1) // alignment * alignment
        if offsets and payload + max(offsets) >= size:
            raise ValueError("Tensor payload is truncated")
    # A content-addressed metadata shard may have been moved to a shared directory.
    filename = re.sub(r"^[0-9a-f]{12,64}-", "", path.name, flags=re.I)
    match = SHARD.match(filename)
    index = int(match[2]) if match else int(metadata.get("split.no", 0)) + 1
    count = int(metadata.get("split.count", int(match[3]) if match else 1))
    if count < 1 or count > 10000 or not 1 <= index <= count:
        raise ValueError("Invalid shard index/count")
    if match and (
        count != int(match[3]) or metadata.get("split.no", index - 1) != index - 1
    ):
        raise ValueError("Filename and GGUF shard metadata disagree")
    architecture = str(metadata.get("general.architecture", ""))
    hint = (
        filename + " " + str(metadata.get("general.name", "")) + " " + architecture
    ).lower()
    role = "Model"
    for label, pattern in [
        ("Vision", r"mmproj|projector|^clip$"),
        ("DFlash", r"dflash"),
        ("MTP", r"(?:^|[ /_.-])mtp(?:[ /_.-]|$)"),
        ("Engram", r"engram"),
    ]:
        if re.search(pattern, hint):
            role = label
            break
    if role == "Model" and roles and set(roles) <= {"MTP"}:
        role = "MTP"
    if role == "Model" and roles and set(roles) <= {"Engram"}:
        role = "Engram"
    return {
        "path": str(path),
        "name": path.name,
        "bytes": size,
        "architecture": architecture,
        "modelName": metadata.get("general.name", ""),
        "group": match[1] if match else filename[:-5],
        "index": index,
        "count": count,
        "role": role,
        "tensors": dict(roles),
        'encodings': dict(encodings),
        "metadata": metadata,
        "roleEvidence": "tensor names and metadata"
        if roles
        else "metadata and filename; no tensors",
    }


if __name__ == "__main__":
    import json
    import sys
    try:
        print(json.dumps(inspect(sys.argv[1])))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
