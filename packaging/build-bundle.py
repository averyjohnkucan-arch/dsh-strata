"""Create one importable plugin containing Strata, Python, CUDA libraries and the GGUF helper."""

from pathlib import Path
import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile

REPO = Path(__file__).resolve().parents[1]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(4 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def unpack_engine(source, target):
    manifest = json.loads((source / "manifest.json").read_text())
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile() as compressed:
        for part in manifest["parts"]:
            path = source / part["path"]
            if sha256(path) != part["sha256"]:
                raise ValueError("Engine archive part checksum mismatch: " + part["path"])
            with path.open("rb") as stream:
                shutil.copyfileobj(stream, compressed)
        compressed.seek(0)
        with gzip.GzipFile(fileobj=compressed) as stream, target.open("wb") as output:
            shutil.copyfileobj(stream, output)
    if sha256(target) != manifest["engineSha256"]:
        raise ValueError("Engine checksum mismatch")
    target.chmod(0o755)
    return manifest


def build(runtime, output):
    runtime = Path(runtime).resolve()
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    version = json.loads((REPO / "package.json").read_text())["version"]
    expected = json.loads((REPO / "engine.json").read_text())
    for component in ("control", "engine"):
        stamp = (runtime / component / ".archive-sha256").read_text().strip()
        if stamp not in {asset["sha256"] for asset in expected["assets"]}:
            raise ValueError("Unverified upstream " + component + " archive")
    with tempfile.TemporaryDirectory() as stage:
        stage = Path(stage)
        result = subprocess.check_output(["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", str(stage)], cwd=REPO, text=True)
        source = stage / json.loads(result)[0]["filename"]
        with tarfile.open(source) as archive:
            archive.extractall(stage, filter="data")
        package = stage / "package"
        bundled = package / "runtime"
        shutil.copytree(runtime / "control", bundled / "control", symlinks=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        shutil.copytree(runtime / "engine", bundled / "engine", symlinks=True)
        projection = bundled / "control/data/experimental-speed-projection/Qwen3.8-Flash-Next-experimental-speed-projection.gguf"
        if not projection.is_file():
            raise ValueError("The Control runtime is missing its projection asset")
        stock = unpack_engine(REPO / "vendor/strata-engine", bundled / "engine/strata")
        fork = unpack_engine(REPO / "vendor/gyro-l-engine", bundled / "gyro-l/strata")
        # Compressed source-install parts are redundant in an offline bundle with the extracted engine.
        shutil.rmtree(package / "vendor/gyro-l-engine/parts")
        shutil.rmtree(package / "vendor/strata-engine/parts")
        manifest = {
            "pluginVersion": version,
            "runtimeVersion": expected["runtimeVersion"],
            "platform": "linux",
            "arch": "x64",
            "cuda": "13",
            "strataRelease": expected["release"],
            "controlVersion": expected["controlVersion"],
            "engineVersion": expected["engineVersion"],
            "engineSha256": sha256(bundled / "engine/strata"),
            "projectionSha256": sha256(projection),
            "cudaArchitectures": stock["cudaArchitectures"],
            "fork": {"engineSha256": fork["engineSha256"], "cudaArchitectures": fork["cudaArchitectures"]},
        }
        (bundled / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        name = f"dsh-strata-{version}-linux-x64-cuda13.tgz"
        artifact = output / name
        with tarfile.open(artifact, "w:gz", compresslevel=6) as archive:
            archive.add(package, arcname="package", filter=lambda info: None if "__pycache__" in Path(info.name).parts or info.name.endswith(".pyc") else info)
        digest = sha256(artifact)
        artifact.with_name(name + ".sha256").write_text(digest + "  " + name + "\n")
        print(json.dumps({"artifact": str(artifact), "sha256": digest, "bytes": artifact.stat().st_size}))


def build_from_bundle(bundle, output):
    """Repackage the pinned runtime with the current plugin, without engine archives in Git."""
    bundle = Path(bundle).resolve()
    expected = json.loads((REPO / "engine.json").read_text())
    if sha256(bundle) != expected["runtimeBundleSha256"]:
        raise ValueError("Runtime bundle checksum mismatch")
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    version = json.loads((REPO / "package.json").read_text())["version"]
    with tempfile.TemporaryDirectory() as stage:
        stage = Path(stage)
        result = subprocess.check_output(["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", str(stage)], cwd=REPO, text=True)
        with tarfile.open(stage / json.loads(result)[0]["filename"]) as archive:
            archive.extractall(stage, filter="data")
        package = stage / "package"
        with tarfile.open(bundle) as archive:
            archive.extractall(stage, members=[m for m in archive if m.name.startswith("package/runtime/")], filter="data")
        manifest_path = package / "runtime/manifest.json"
        manifest = json.loads(manifest_path.read_text())
        if (manifest.get("runtimeVersion") or manifest.get("pluginVersion")) != expected["runtimeVersion"]:
            raise ValueError("Runtime bundle version mismatch")
        # Older base bundles identify their runtime only by pluginVersion.
        # Preserve that identity before stamping the new plugin release.
        manifest["runtimeVersion"] = expected["runtimeVersion"]
        manifest["pluginVersion"] = version
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        name = f"dsh-strata-{version}-linux-x64-cuda13.tgz"
        artifact = output / name
        with tarfile.open(artifact, "w:gz", compresslevel=6) as archive:
            archive.add(package, arcname="package", filter=lambda info: None if "__pycache__" in Path(info.name).parts or info.name.endswith(".pyc") else info)
        digest = sha256(artifact)
        artifact.with_name(name + ".sha256").write_text(digest + "  " + name + "\n")
        print(json.dumps({"artifact": str(artifact), "sha256": digest, "bytes": artifact.stat().st_size}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--runtime-root")
    source.add_argument("--bundle")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.bundle:
        build_from_bundle(args.bundle, args.output)
    else:
        build(args.runtime_root, args.output)
