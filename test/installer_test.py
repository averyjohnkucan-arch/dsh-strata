"""The source installer verifies release bytes before publishing a runtime."""

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("strata_installer", Path(__file__).parents[1] / "python/install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTest(unittest.TestCase):
    def test_verified_bundle_is_installed_and_bad_checksum_leaves_no_runtime(self):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode="w:gz") as archive:
            payload = json.dumps({"runtimeVersion": "0.5.0"}).encode()
            info = tarfile.TarInfo("package/runtime/manifest.json")
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
        bundle = data.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "runtime"
            with patch.object(installer.urllib.request, "urlopen", side_effect=lambda *_a, **_k: io.BytesIO(bundle)):
                with patch.dict(installer.ENGINE, {"runtimeBundleSha256": "0" * 64}):
                    with self.assertRaisesRegex(ValueError, "checksum"):
                        installer.install(root)
                self.assertFalse(root.exists())
                with patch.dict(installer.ENGINE, {"runtimeBundleSha256": hashlib.sha256(bundle).hexdigest()}):
                    installer.install(root)
            self.assertTrue((root / "manifest.json").is_file())


if __name__ == "__main__":
    unittest.main()
