"""Fresh installs recover only the verified legacy fork from the old release."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('strata_installer', Path(__file__).parents[1] / 'python/install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTest(unittest.TestCase):
    def test_legacy_fork_download_is_verified_before_use(self):
        payload = b'legacy fork executable'
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w:gz') as archive:
            info = tarfile.TarInfo('package/runtime/gyro-l/strata')
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
        bundle = data.getvalue()
        legacy = {**installer.ENGINE['legacyRuntime'],
                  'sha256': hashlib.sha256(bundle).hexdigest(),
                  'forkSha256': hashlib.sha256(payload).hexdigest()}
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            with patch.object(installer.urllib.request, 'urlopen', side_effect=lambda *_a, **_k: io.BytesIO(bundle)):
                with patch.dict(installer.ENGINE, legacyRuntime=legacy):
                    installer.legacy_fork(base/'new', base/'stage')
                self.assertEqual((base/'stage/gyro-l/strata').read_bytes(), payload)
                with patch.dict(installer.ENGINE, legacyRuntime={**legacy, 'sha256': '0'*64}):
                    with self.assertRaisesRegex(ValueError, 'Checksum'):
                        installer.legacy_fork(base/'new', base/'bad')
                self.assertFalse((base/'bad/gyro-l/strata').exists())


if __name__ == '__main__':
    unittest.main()
