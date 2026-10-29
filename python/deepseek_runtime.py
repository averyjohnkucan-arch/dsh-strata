"""One native DeepSeek engine installation shared by every managed model profile."""

from contextlib import contextmanager
from pathlib import Path
import argparse
import importlib
import os


@contextmanager
def install_lock(root):
    """Downloads/migration are serialized across bridge processes, not just UI jobs."""
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".install.lock").open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            lock.write(b"\0")
            lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def download_engine(engine, destination):
    """Upstream owns feed selection, signatures, checksums and resumable transfer."""
    from strata_cli import update_cmd
    from strata_control import acquisition
    acquisition.require("the DeepSeek engine")
    source = update_cmd._feed_source(argparse.Namespace(feed=None), destination.parent)
    return engine.install(destination, source, emit=lambda text: print(text, flush=True))


def ensure(payload, engine=None):
    engine = engine or importlib.import_module("strata_control.dsv41_engine")
    root = Path(payload["deepseekRuntimeRoot"])
    destination = root / "engine-dsv41"
    legacy = Path(payload["legacyModelsRoot"])
    with install_lock(root):
        executable = engine.find(destination)
        if executable:
            print("Reusing the shared DeepSeek engine.", flush=True)
        else:
            candidates = [engine.find(folder) for folder in legacy.glob("*/engine-dsv41")]
            candidates = sorted((path for path in candidates if path),
                                key=lambda path: engine.version_key(path.parent.name), reverse=True)
            for candidate in candidates:
                print("Checking an already installed DeepSeek engine for shared reuse.", flush=True)
                # Native installation verifies the package signature and every file
                # before copying it. The old profile's runtime stays untouched.
                executable = engine.install_package(destination, candidate.parent,
                                                     emit=lambda text: print(text, flush=True))
                if executable:
                    break
            if not executable:
                executable = download_engine(engine, destination)
            if not executable:
                raise ValueError("The shared DeepSeek runtime could not be installed; see the native installer log and retry.")
        return {"exe": str(executable), "lib_dirs": engine.lib_dirs(executable)}
