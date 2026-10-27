"""Recover the runtime from this repository's self-contained release package."""

from pathlib import Path
import hashlib
import json
import platform
import shutil
import sys
import tarfile
import tempfile
import urllib.request

VERSION = "0.5.0"
NAME = f"dsh-strata-{VERSION}-linux-x64-cuda13.tgz"
BASE = f"https://github.com/averyjohnkucan-arch/dsh-strata/releases/download/v{VERSION}"


def install(root):
    if (platform.system(), platform.machine()) != ("Linux", "x86_64"):
        raise ValueError("This bundled runtime is for Linux x86-64 NVIDIA CUDA 13")
    root = Path(root).resolve()
    if not (root / "manifest.json").is_file():
        root.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root.parent) as stage:
            stage = Path(stage)
            archive = stage / NAME
            print("Acquiring the self-contained Strata package from this plugin's GitHub release", flush=True)
            with urllib.request.urlopen(BASE + "/" + NAME + ".sha256", timeout=60) as response:
                expected = response.read(1024).decode().split()[0]
            digest = hashlib.sha256()
            with urllib.request.urlopen(BASE + "/" + NAME, timeout=120) as response, archive.open("wb") as target:
                received = 0
                while block := response.read(4 * 1024 * 1024):
                    target.write(block)
                    digest.update(block)
                    received += len(block)
                    print(f"Received {received // 1048576} MiB", flush=True)
            if digest.hexdigest() != expected:
                raise ValueError("Self-contained package checksum mismatch")
            with tarfile.open(archive) as bundle:
                # Install only runtime files; executable plugin code comes from the package DSH loaded.
                bundle.extractall(stage, members=[m for m in bundle if m.name.startswith("package/runtime/")], filter="data")
            source = stage / "package/runtime"
            if not (source / "manifest.json").is_file():
                raise ValueError("The release package contains no runtime manifest")
            if root.exists():
                raise ValueError("Runtime directory contains an incomplete installation; choose a new data directory")
            source.rename(root)
    print("DSH_RESULT=" + json.dumps({"root": str(root)}), flush=True)


if __name__ == "__main__":
    try:
        install(sys.argv[1])
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
