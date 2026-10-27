"""Recursive model inventory. Scanning never modifies or loads a model."""

from collections import defaultdict
from pathlib import Path
import argparse
import hashlib
import json
import os
import sys

from gguf import inspect


def compatibility(model):
    """Conservative known blockers; a supported header still requires engine validation."""
    arch = model['architecture']
    if not arch:
        return 'Unknown architecture; inspect the model metadata before setup.'
    if arch == 'qwen4exp':
        known = set(range(43)) | {143, 144, 145, 146}
        unsupported = sorted({int(code) for file in model['files'] for code in file.get('encodings', {})} - known)
        if unsupported and set(unsupported) <= {147, 148, 149}:
            return 'Gyro L requires a TQP5/6/7 Strata fork. Choose it under Runtime compatibility.'
        if unsupported:
            return 'Stock Strata v0.2.7 does not support tensor encoding(s): ' + ', '.join(map(str, unsupported))
        return None
    if arch == 'qwen35moe':
        if not any('qwen35moe.nextn_predict_layers' in file['metadata'] for file in model['files']):
            return 'Stock native Qwen requires nextn_predict_layers metadata; this model does not contain it.'
        return None
    return 'Local preparation for this architecture is unavailable. The download flow uses Strata’s supported catalog.'


def scan(root, selected=None):
    root = Path(root).expanduser()
    if not root.is_absolute() or not root.is_dir():
        raise ValueError("Choose an existing absolute folder path")
    groups, errors, visited, physical = defaultdict(list), [], set(), set()
    pending = [root]
    count = 0
    # Follow directory links, but visit every physical directory/file only once.
    while pending:
        directory = pending.pop()
        try:
            stat = directory.stat()
            identity = (stat.st_dev, stat.st_ino)
            if identity in visited:
                continue
            visited.add(identity)
            with os.scandir(directory) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir():
                            pending.append(Path(entry.path))
                        elif entry.name.lower().endswith(".gguf") and entry.is_file():
                            stat = entry.stat()
                            identity = (stat.st_dev, stat.st_ino)
                            if identity in physical:
                                continue
                            physical.add(identity)
                            count += 1
                            if count > 100_000:
                                raise RuntimeError(
                                    "Scan limit reached (100,000 GGUF files); choose a smaller folder"
                                )
                            item = inspect(entry.path)
                            # Filenames retain the quantization; architecture guards unrelated sets.
                            # Later split shards often omit architecture/name entirely.
                            key = (item["group"].casefold(), item["count"])
                            groups[key].append(item)
                    except (OSError, ValueError) as error:
                        errors.append({"path": entry.path, "error": str(error)})
        except OSError as error:
            errors.append({"path": str(directory), "error": str(error)})
    models, components = [], []
    sets = []
    for key, files in sorted(groups.items()):
        indices = [f["index"] for f in files]
        if len(indices) == len(set(indices)):
            sets.append((key, files))
        else:
            # Independent copies/quantizations must never be silently interleaved.
            by_directory = defaultdict(list)
            for file in files:
                by_directory[str(Path(file["path"]).parent)].append(file)
            sets.extend((key, values) for values in by_directory.values())
    for key, files in sets:
        files.sort(key=lambda f: (f["index"], f["path"]))
        indices = defaultdict(list)
        for file in files:
            indices[file["index"]].append(file)
        missing = [i for i in range(1, key[1] + 1) if i not in indices]
        duplicates = [i for i, values in indices.items() if len(values) > 1]
        # A component-only split shard remains part of its model's set.
        roles = {f["role"] for f in files}
        role = "Model" if "Model" in roles else files[0]["role"]
        architectures = {f["architecture"] for f in files if f["architecture"]}
        if len(architectures) > 1:
            duplicates.append("conflicting architectures")
        model = {
            "id": hashlib.sha256(
                json.dumps([key, [f["path"] for f in files]]).encode()
            ).hexdigest()[:24],
            "name": files[0]["group"],
            "architecture": next(iter(architectures), ""),
            "files": files,
            "role": role,
            "expected": key[1],
            "missing": missing,
            "duplicates": duplicates,
            "status": "missing" if missing else "review" if duplicates else "complete",
            "bytes": sum(f["bytes"] for f in files),
            "components": [],
            "warnings": ["Shards assembled across directories; review their source."]
            if len({str(Path(f["path"]).parent) for f in files}) > 1
            else [],
        }
        (models if role == "Model" else components).append(model)
        if role == 'Model':
            model['setupIssue'] = compatibility(model)
    # Suggest nearby auxiliary files; selection remains explicit, especially with multiple quants.
    for model in models:
        parent = Path(model["files"][0]["path"]).parent
        for component in components:
            other = Path(component["files"][0]["path"]).parent
            common = Path(os.path.commonpath([parent, other]))
            if parent == other or (common != root and len(common.parts) >= len(root.parts) + 1):
                model["components"].append(component["id"])
    if selected:
        paths = {str(Path(path).resolve(strict=True)) for path in selected}
        models = [model for model in models if any(str(Path(file["path"]).resolve()) in paths for file in model["files"])]
    return {
        "root": str(root),
        "filesScanned": count,
        "models": models,
        "components": components,
        "errors": errors,
        "limitations": [
            "GGUF headers are inspected; payload hashes and numerical compatibility are not established.",
            "Other formats remain outside this GGUF inventory.",
        ],
    }


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("root")
        parser.add_argument("--files", nargs="+")
        args = parser.parse_args()
        print(json.dumps(scan(args.root, args.files)))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
