"""Install pinned upstream releases beside existing runtimes, never over them."""
from pathlib import Path
import hashlib
import json
import os
import platform
import shutil
import sys
import tarfile
import tempfile
import urllib.request

ENGINE = json.loads((Path(__file__).parents[1] / "engine.json").read_text())
VERSION = ENGINE["runtimeVersion"]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while block := stream.read(4 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def acquire(asset, directory):
    """Local archives and HTTPS downloads follow the same checksum rules."""
    name = asset.get("name") or asset["url"].rsplit("/", 1)[-1]
    cache = os.environ.get("DSH_STRATA_ASSET_CACHE")
    cached = Path(cache) / name if cache else None
    target = cached if cached and cached.is_file() else directory / name
    if not (cached and cached.is_file()):
        print("Downloading " + name, flush=True)
        with urllib.request.urlopen(asset["url"], timeout=120) as source, target.open("wb") as output:
            received = 0
            while block := source.read(4 * 1024 * 1024):
                output.write(block)
                received += len(block)
                print(f"{name}: {received // 1048576} MiB received", flush=True)
    if sha256(target) != asset["sha256"]:
        raise ValueError("Checksum mismatch: " + name)
    return target


def legacy_fork(root, stage):
    """Keep the tested Gyro L fork while updating the stock upstream engine."""
    legacy = ENGINE["legacyRuntime"]
    existing = root.parent / legacy["version"] / "gyro-l/strata"
    destination = stage / "gyro-l/strata"
    destination.parent.mkdir(parents=True)
    if existing.is_file() and sha256(existing) == legacy["forkSha256"]:
        shutil.copy2(existing, destination)
    else:
        archive = acquire(legacy, stage)
        with tarfile.open(archive) as bundle:
            member = bundle.getmember("package/runtime/gyro-l/strata")
            with bundle.extractfile(member) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output)
        if archive.parent == stage:
            archive.unlink()
    if sha256(destination) != legacy["forkSha256"]:
        raise ValueError("Legacy Gyro L engine checksum mismatch")
    destination.chmod(0o755)


def install(root):
    if (platform.system(), platform.machine()) != ("Linux", "x86_64"):
        raise ValueError("This runtime is for Linux x86-64 NVIDIA CUDA 13")
    root = Path(root).resolve()
    if (root / "manifest.json").is_file():
        manifest = json.loads((root / "manifest.json").read_text())
        if manifest.get("runtimeVersion") != VERSION:
            raise ValueError("Existing runtime has a different version")
    else:
        root.parent.mkdir(parents=True, exist_ok=True)
        if root.exists():
            raise ValueError("Runtime directory contains an incomplete installation")
        with tempfile.TemporaryDirectory(prefix="strata-update-", dir=root.parent) as temporary:
            stage = Path(temporary)
            runtime = stage / "runtime"
            runtime.mkdir()
            for asset in ENGINE["assets"]:
                archive = acquire(asset, stage)
                target = runtime / asset["component"]
                target.mkdir()
                with tarfile.open(archive) as bundle:
                    bundle.extractall(target, filter="data")
                (target / ".archive-sha256").write_text(asset["sha256"] + "\n")
            legacy_fork(root, runtime)
            for required in ("control/python/bin/python3", "control/strata.py", "engine/strata"):
                if not (runtime / required).is_file():
                    raise ValueError("Upstream archive is missing " + required)
            manifest = {
                "runtimeVersion": VERSION, "pluginVersion": VERSION,
                "platform": "linux", "arch": "x64", "cuda": "13",
                "strataRelease": ENGINE["release"],
                "controlVersion": ENGINE["controlVersion"],
                "engineVersion": ENGINE["engineVersion"],
                "engineSha256": sha256(runtime / "engine/strata"),
                "fork": {"engineSha256": ENGINE["legacyRuntime"]["forkSha256"],
                         "legacy": True, "cudaArchitectures": ["120"]},
            }
            (runtime / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
            runtime.rename(root)
    print("DSH_RESULT=" + json.dumps({"root": str(root)}), flush=True)


if __name__ == "__main__":
    try:
        install(sys.argv[1])
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
