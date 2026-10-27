"""Install pinned official packages in private plugin storage; no system changes."""

from pathlib import Path
import hashlib
import json
import platform
import subprocess
import sys
import tarfile
import tempfile
import urllib.request


def install(root):
    if (platform.system(), platform.machine()) != ("Linux", "x86_64"):
        raise ValueError(
            "Automatic runtime installation requires Linux x86-64 NVIDIA. Set existing runtime paths on other systems."
        )
    metadata = json.loads((Path(__file__).parents[1] / "engine.json").read_text())
    variant = "cuda13"
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    result = {}
    for asset in metadata["assets"]:
        control = asset["name"].startswith("strata-control")
        if not control and variant not in asset["name"]:
            continue
        dest = root / ("control" if control else "engine")
        stamp = dest / ".archive-sha256"
        if not stamp.is_file() or stamp.read_text() != asset["sha256"]:
            if dest.exists():
                raise ValueError(
                    f"Runtime directory already contains a different installation: {dest}"
                )
            archive = root / (asset["name"] + ".part")
            digest = hashlib.sha256()
            print("Downloading " + asset["name"], flush=True)
            with (
                urllib.request.urlopen(asset["url"], timeout=120) as response,
                archive.open("wb") as target,
            ):
                received = 0
                while block := response.read(4 * 1024 * 1024):
                    target.write(block)
                    digest.update(block)
                    received += len(block)
                    print(f"Downloaded {received // 1048576} MiB", flush=True)
            if digest.hexdigest() != asset["sha256"]:
                raise ValueError("Official release checksum mismatch: " + asset["name"])
            with tempfile.TemporaryDirectory(dir=root) as stage:
                stage = Path(stage)
                with tarfile.open(archive) as bundle:
                    bundle.extractall(stage, filter="data")
                markers = list(
                    stage.rglob("strata.py" if control else "engine-component.json")
                )
                if len(markers) != 1:
                    raise ValueError("Unexpected official package layout")
                folder = markers[0].parent
                (folder / ".archive-sha256").write_text(asset["sha256"])
                folder.rename(dest)
            archive.unlink()
        result["controlDir" if control else "executable"] = str(
            dest if control else dest / "strata"
        )
    result["python"] = str(Path(result["controlDir"]) / "python/bin/python3")
    result["release"] = metadata["release"]
    print("DSH_RESULT=" + json.dumps(result), flush=True)


if __name__ == "__main__":
    try:
        install(sys.argv[1])
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
