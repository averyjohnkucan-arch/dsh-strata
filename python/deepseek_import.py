"""Local DeepSeek setup delegates file verification, packing and engine acquisition upstream."""

from pathlib import Path
from types import SimpleNamespace
import json
import os
import re
import subprocess
import sys


def selection(setup, files):
    """Match one complete native catalog set, including upstream's legacy filenames."""
    names = {Path(file["path"]).name for file in files}
    family = setup.MULTI_FILE_FAMILIES["deepseek41"]
    for name, model in family["models"].items():
        expected = model["shards"]
        if len(names) == len(expected) and all(
            current in names or setup.DSV41_LEGACY_NAMES.get(current) in names
            for current in expected
        ):
            return name, model
    raise ValueError(
        "These DeepSeek shards do not match a supported native Strata set. "
        "Use a complete IST-DAS IQ1_M, IQ2_XXS, IQ2_XS or Unsloth UD-Q8_K_XL set with its original filenames."
    )


def link_file(source, destination):
    source = source.resolve(strict=True)
    if destination.is_symlink() and destination.resolve() != source:
        raise ValueError("A staged DeepSeek component refers to a different source")
    if not destination.exists():
        destination.symlink_to(source)


def prepare(source, payload, setup):
    profile = payload["profile"]
    root = Path(payload["root"])
    files = profile["model"]["files"]
    # stage_files has already normalized the canonical shard names; metadata is
    # verified by native setup before it writes any usable engine configuration.
    staged = root / "shards"
    names = [
        re.sub(r"^[0-9a-f]{12,64}-", "", Path(file["path"]).name, flags=re.I)
        for file in files
    ]
    staged_files = [{"path": str(staged / name)} for name in names]
    name, model = selection(setup, staged_files)
    shared = root / "data" / "models" / "deepseek-v4.1-flash-shared"
    for component in model.get("shared", []):
        for folder in dict.fromkeys(Path(file["path"]).resolve().parent for file in files):
            found = setup.dsv41_find_shared(SimpleNamespace(gguf_dir=str(folder)), component, folder, shared)
            if found.is_file():
                link_file(found, staged / found.name)
                break
    command = [
        sys.executable, "-B", str(source / "setup.py"),
        "--family", "deepseek41", "--model", name,
        "--gguf-dir", str(staged), "--data-dir", str(root / "data"),
        "--context", str(profile["context"]), "--gpu", str(profile["gpu"]),
        "--port", str(profile["port"]), "--yes", "--no-start", "--no-browser",
        "--vision", "no", "--images", "no",
    ]
    env = {
        **os.environ,
        "STRATA_CONTROL_INSTALL": "1", "STRATA_INSTALL_DIR": str(root),
        # Preparation is a disk operation. The plugin's scheduled server load
        # performs GPU validation; a second unscheduled smoke process must not
        # compete with another provider during an Import/Prepare job.
        "STRATA_DSV41_NO_SMOKE": "1",
    }
    executable = payload["runtime"].get("executable", "")
    if Path(executable).name in ("strata-dsv41", "strata-dsv41.exe"):
        env["STRATA_DSV41_EXE"] = executable
    print("Preparing DeepSeek with Strata's native setup; existing files are verified and reused.", flush=True)
    subprocess.run(command, cwd=source, env=env, check=True)
    configs = [json.loads(path.read_text()) for path in root.glob("strata-*.json")]
    configs = [config for config in configs if config.get("arch") == "deepseek41"]
    if len(configs) != 1:
        raise ValueError("Native DeepSeek setup did not publish exactly one configuration")
    config = configs[0]
    config.update(model_name=profile["id"], port=profile["port"], host="127.0.0.1", open_browser=False)
    return config
