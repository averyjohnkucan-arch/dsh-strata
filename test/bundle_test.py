"""Offline repackaging must preserve the runtime identity of old release bundles."""
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("strata_bundle", Path(__file__).parents[1] / "packaging/build-bundle.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def archive_file(archive, name, value):
    data = json.dumps(value).encode()
    info = tarfile.TarInfo(name)
    info.size = len(data)
    archive.addfile(info, io.BytesIO(data))


class BundleTest(unittest.TestCase):
    def test_legacy_runtime_marker_survives_new_plugin_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = root / "base.tgz"
            with tarfile.open(bundle, "w:gz") as archive:
                archive_file(archive, "package/runtime/manifest.json", {
                    "pluginVersion": "0.5.0", "platform": "linux", "arch": "x64",
                })
            (root / "package.json").write_text(json.dumps({"version": "0.7.1"}))
            (root / "engine.json").write_text(json.dumps({
                "runtimeVersion": "0.5.0", "runtimeBundleSha256": builder.sha256(bundle),
            }))

            def npm_pack(command, **_):
                stage = Path(command[command.index("--pack-destination") + 1])
                with tarfile.open(stage / "source.tgz", "w:gz") as archive:
                    archive_file(archive, "package/package.json", {"version": "0.7.1"})
                return json.dumps([{"filename": "source.tgz"}])

            with patch.object(builder, "REPO", root), patch.object(builder.subprocess, "check_output", side_effect=npm_pack):
                builder.build_from_bundle(bundle, root / "output")
            with tarfile.open(root / "output/dsh-strata-0.7.1-linux-x64-cuda13.tgz") as archive:
                manifest = json.load(archive.extractfile("package/runtime/manifest.json"))
            # This is the compatibility check the plugin's bundledRuntime uses.
            self.assertEqual(manifest.get("runtimeVersion") or manifest["pluginVersion"], "0.5.0")
            self.assertEqual(manifest["pluginVersion"], "0.7.1")


if __name__ == "__main__":
    unittest.main()
