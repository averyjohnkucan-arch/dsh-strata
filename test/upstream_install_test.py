"""A runtime update is verified and atomic; old benchmark runtimes survive."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('upstream_install', Path(__file__).parents[1] / 'python/install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class UpstreamInstallTests(unittest.TestCase):
    def fixture(self, directory):
        base = Path(directory)
        old = base / '0.5.0/gyro-l/strata'
        old.parent.mkdir(parents=True)
        old.write_bytes(b'tested legacy engine')
        assets = []
        for component, files in [('control', ['python/bin/python3', 'strata.py']), ('engine', ['strata'])]:
            archive = base / (component + '.tgz')
            with tarfile.open(archive, 'w:gz') as t:
                for name in files:
                    body = b'upstream fixture'
                    info = tarfile.TarInfo(name)
                    info.size = len(body)
                    info.mode = 0o755
                    t.addfile(info, io.BytesIO(body))
            assets.append({'name': archive.name, 'url': 'https://invalid.example/' + archive.name,
                           'component': component, 'sha256': installer.sha256(archive)})
        return base, old, {**installer.ENGINE, 'assets': assets,
                          'legacyRuntime': {**installer.ENGINE['legacyRuntime'],
                                            'forkSha256': installer.sha256(old)}}

    def test_verified_update_is_separate_and_reusable(self):
        with tempfile.TemporaryDirectory() as directory:
            base, old, engine = self.fixture(directory)
            original = old.read_bytes()
            with patch.object(installer, 'ENGINE', engine), patch.dict(os.environ, DSH_STRATA_ASSET_CACHE=str(base)):
                installer.install(base / installer.VERSION)
                installer.install(base / installer.VERSION)
            manifest = json.loads((base / installer.VERSION / 'manifest.json').read_text())
            self.assertEqual(manifest['engineVersion'], '0.1.55')
            self.assertEqual(old.read_bytes(), original)
            self.assertEqual((base / installer.VERSION / 'gyro-l/strata').read_bytes(), original)

    def test_corrupt_download_never_commits_partial_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            base, old, engine = self.fixture(directory)
            engine['assets'][1]['sha256'] = '0' * 64
            with patch.object(installer, 'ENGINE', engine), patch.dict(os.environ, DSH_STRATA_ASSET_CACHE=str(base)):
                with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
                    installer.install(base / installer.VERSION)
            self.assertFalse((base / installer.VERSION).exists())
            self.assertTrue(old.is_file())


if __name__ == '__main__':
    unittest.main()
