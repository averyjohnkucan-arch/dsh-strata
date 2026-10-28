"""Small adapter to stock Strata. Upstream owns model packing and auto-tuning."""

from pathlib import Path
import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile


def setup_module(source):
    sys.path.insert(0, str(source))
    spec = importlib.util.spec_from_file_location(
        "dsh_strata_setup", source / "setup.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def catalog(source):
    setup = setup_module(source)
    result = []
    for key, family in setup.FAMILIES.items():
        for name, model in setup.MODELS.items():
            if key in model.get("families", ("qwen", "swift")):
                result.append(
                    {
                        "family": key,
                        "model": name,
                        "title": family["title"],
                        "about": model.get("about", ""),
                        "downloadGB": model.get("download_gb"),
                        "ramGB": model.get("ram_gb"),
                    }
                )
    for key, family in {**setup.OWN_PATH_FAMILIES, **setup.MULTI_FILE_FAMILIES}.items():
        for name, model in family["models"].items():
            result.append(
                {
                    "family": key,
                    "model": name,
                    "title": family["title"],
                    "about": model.get("about", ""),
                    "ramGB": model.get("ram_gb"),
                }
            )
    return result


def stage_files(model, folder):
    """Give upstream packers adjacent canonical shard names without copying weights."""
    folder.mkdir(parents=True, exist_ok=True)
    first = None
    for file in model["files"]:
        name = re.sub(r"^[0-9a-f]{12,64}-", "", Path(file["path"]).name, flags=re.I)
        target = folder / name
        source = Path(file["path"]).resolve(strict=True)
        if target.is_symlink() and target.resolve() != source:
            raise ValueError("A staged shard refers to a different source")
        if not target.exists():
            target.symlink_to(source)
        if file["index"] == 1:
            first = target
    if first is None:
        raise ValueError("The first model shard is missing")
    return first


def prepare_flash_mtp(source, root):
    """Use Strata's verified fetch and packing tools for its Flash-Next draft."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    runtime = root / "rt"
    required = ("experts.bin", "dense.bin", "dense.txt", "draft_vocab.bin")
    if all((runtime / name).is_file() for name in required):
        return runtime
    setup = setup_module(source)
    packed = root / "mtp-q2_0.gguf"
    if not packed.is_file():
        print("Downloading Strata's separate MTP draft (about 5 GB)", flush=True)
        setup.fetch_mtp(root, dict(os.environ))
        temporary = root / "mtp-q2_0.partial.gguf"
        subprocess.run([sys.executable, "-B", str(source / "tools/mtp_pack.py"), "--src", str(root),
                        "--experts", "q2_0", "--out", str(temporary)], cwd=source, check=True)
        temporary.replace(packed)
    with tempfile.TemporaryDirectory(prefix="mtp-build-", dir=root) as stage:
        stage = Path(stage)
        subprocess.run([sys.executable, "-B", str(source / "tools/mtp_rt.py"), "--gguf", str(packed),
                        "--out", str(stage)], cwd=source, check=True)
        setup.refresh_draft_vocab(stage, "cjk")
        if not all((stage / name).is_file() for name in required):
            raise ValueError("Strata did not produce a complete MTP runtime")
        if runtime.exists():
            raise ValueError("Incomplete MTP runtime exists; preserve or remove it before retrying")
        stage.rename(runtime)
    return runtime


def prepare(source, payload):
    profile, root = payload["profile"], Path(payload["root"])
    model = profile["model"]
    if model["status"] != "complete":
        raise ValueError(
            "Resolve missing or duplicate shards before preparing this model"
        )
    first = stage_files(model, root / "shards")
    arch = model["architecture"]
    output = root / "pack"
    output.mkdir(parents=True, exist_ok=True)
    if arch == "qwen35moe":
        if profile.get("mtp"):
            raise ValueError(
                "Stock native Qwen uses embedded MTP; an external donor cannot be attached"
            )
        subprocess.run(
            [
                sys.executable,
                "-B",
                str(source / "tools/strata_tokenizer.py"),
                "--gguf",
                str(first),
                "--out",
                str(output),
                "--check",
            ],
            cwd=source,
            check=True,
        )
        args = [
            "--native",
            str(first),
            "--max-context",
            str(profile["context"]),
            "--kv",
            profile.get("kvArgument", "fp16"),
        ]
    elif arch == "qwen4exp":
        # The official portable Control package does not bundle gguf-py.
        # Let Strata acquire its own pinned helper source under our private install directory.
        helper = os.environ.get("STRATA_GGUF_PY", "")
        if not helper or not (Path(helper) / "gguf").is_dir():
            helper = str(setup_module(source).get_llama_cpp() / "gguf-py")
        os.environ["STRATA_GGUF_PY"] = helper
        subprocess.run(
            [
                sys.executable,
                "-B",
                str(source / "tools/iq_pack.py"),
                "--gguf",
                str(first),
                "--out",
                str(output),
                "--compat-bf16",
            ],
            cwd=source,
            check=True,
        )
        args = [
            "--pack",
            str(output),
            "--native",
            str(first),
            "--max-context",
            str(profile["context"]),
            "--kv",
            profile.get("kvArgument", profile["kv"]),
            # Native IQ packs require an enabled prefill path. Strata sizes both
            # prompt buffers and the expert cache itself; no numeric guesses here.
            "--prefill", "auto",
            "--expert-cache", "auto",
            # The released native IQ path requires a verifier window of at least 2,
            # even without an MTP sidecar. This enables that engine path; it is not
            # a measured speed preset. The native tuner receives this valid baseline.
            "--spec", "2",
            "--expert-profile",
            str(source / "data/expert-profile.bin"),
        ]
        if profile.get("mtp"):
            mtp = (prepare_flash_mtp(source, payload["mtpRoot"])
                   if profile["mtp"] == "auto" else Path(profile["mtp"]))
            if mtp.is_file():
                destination = root / "mtp"
                subprocess.run(
                    [
                        sys.executable,
                        "-B",
                        str(source / "tools/mtp_rt.py"),
                        "--gguf",
                        str(mtp),
                        "--out",
                        str(destination),
                    ],
                    cwd=source,
                    check=True,
                )
                mtp = destination
            if not (mtp / "dense.bin").is_file():
                raise ValueError("MTP is not a supported prepared Strata runtime")
            args += ["--mtp", str(mtp)]
    else:
        raise ValueError(
            f"Stock Strata cannot prepare architecture {arch or 'unknown'} through this importer"
        )
    # Every advanced setting is an argv token; there is no shell-string execution.
    args += profile.get("extraArgs", [])
    config = {
        "exe": payload["runtime"]["executable"],
        "arch": arch,
        "log": str(root / "engine.log"),
        "cwd": str(source),
        "args": args,
        "tokenizer": str(output / "tokenizer"),
        "model_name": profile["id"],
        "port": profile["port"],
        "host": "127.0.0.1",
        "gpu": profile["gpu"],
        "open_browser": False,
        "env": profile.get("environment", {}),
    }
    if profile.get("projector"):
        vision_exe = payload["runtime"].get("visionExecutable") or str(Path(config["exe"]).with_name("strata-vision"))
        config["vision"] = {
            "exe": vision_exe,
            "model": str(first),
            "mmproj": profile["projector"],
        }
    return config


def download(source, payload):
    selected = payload["selection"]
    if not any(
        x["family"] == selected["family"] and x["model"] == selected["model"]
        for x in catalog(source)
    ):
        raise ValueError("Choose a model from the current Strata catalog")
    root = Path(payload["root"])
    root.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "STRATA_CONTROL_INSTALL": "1", "STRATA_INSTALL_DIR": str(root)}
    command = [
        sys.executable,
        "-B",
        str(source / "setup.py"),
        "--family",
        selected["family"],
        "--model",
        selected["model"],
        "--yes",
        "--no-start",
        "--no-browser",
        "--vision",
        "no",
        "--images",
        "no",
        "--data-dir",
        str(root / "data"),
    ]
    subprocess.run(command, cwd=source, env=env, check=True)
    configs = list(root.glob("strata-*.json"))
    if len(configs) != 1:
        raise ValueError("Strata setup did not publish exactly one model configuration")
    return {"config": json.loads(configs[0].read_text()), "path": str(configs[0])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["catalog", "prepare", "download", "preset"])
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    sys.path.insert(0, str(source))
    payload = json.load(sys.stdin)
    if args.action == "catalog":
        result = catalog(source)
    elif args.action == "prepare":
        result = prepare(source, payload)
    elif args.action == "download":
        result = download(source, payload)
    else:
        from strata_control.presets import overlay

        config, receipt = overlay(payload["config"], use=payload.get("use", "chat"))
        result = {"config": config, "preset": receipt}
    print("DSH_RESULT=" + json.dumps(result), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
