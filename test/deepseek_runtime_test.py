"""Shared native runtime reuse across independent profile preparation processes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "python"))
from deepseek_runtime import ensure

class Engine:
    def __init__(self):
        self.migrations = []

    @staticmethod
    def find(destination):
        return next(iter(sorted(Path(destination).glob("*/strata-dsv41"))), None)

    @staticmethod
    def version_key(name):
        return tuple(map(int, name.split('-')[0].split('.')))

    @staticmethod
    def lib_dirs(executable):
        return [str(executable.parent)]

    def install_package(self, destination, source, emit):
        self.migrations.append(source)
        if not (source / 'signed-and-valid').exists():
            return None
        target = destination / source.name
        shutil.copytree(source, target)
        return target / 'strata-dsv41'

class SharedRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = {'deepseekRuntimeRoot': str(self.root/'runtime/deepseek'),
                        'legacyModelsRoot': str(self.root/'models')}
        self.engine = Engine()

    def legacy(self, name='old-profile', valid=True):
        folder = self.root/'models'/name/'engine-dsv41/0.1.52-linux'
        folder.mkdir(parents=True)
        (folder/'strata-dsv41').write_text('native executable')
        (folder/'private-library.so').write_text('native library')
        if valid: (folder/'signed-and-valid').write_text('fixture for native verification')
        return folder

    def test_two_profiles_reuse_one_verified_engine_without_download(self):
        original = self.legacy()
        with patch('deepseek_runtime.download_engine', side_effect=AssertionError('Unexpected download')):
            a = ensure(self.payload, self.engine)
            b = ensure({**self.payload, 'root': str(self.root/'models/desktop-copy')}, self.engine)
        self.assertEqual(a, b)
        self.assertEqual(len(self.engine.migrations), 1)
        self.assertNotEqual(Path(a['exe']).parent, original)
        self.assertTrue((original/'strata-dsv41').exists())
        shutil.rmtree(original.parent.parent)
        self.assertTrue(Path(b['exe']).exists())
        self.assertTrue((Path(b['exe']).parent/'private-library.so').exists())

    def test_concurrent_requests_migrate_once(self):
        self.legacy()
        with patch('deepseek_runtime.download_engine', side_effect=AssertionError('Unexpected download')):
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _: ensure(self.payload, self.engine), range(4)))
        self.assertEqual(len(self.engine.migrations), 1)
        self.assertTrue(all(result == results[0] for result in results))

    def test_invalid_legacy_package_is_not_reused(self):
        self.legacy(valid=False)
        with patch('deepseek_runtime.download_engine', return_value=None) as download:
            with self.assertRaisesRegex(ValueError, 'could not be installed'):
                ensure(self.payload, self.engine)
        download.assert_called_once()

    def test_failed_install_releases_lock_and_next_attempt_can_retry(self):
        with patch('deepseek_runtime.download_engine', side_effect=RuntimeError('cancelled')):
            with self.assertRaisesRegex(RuntimeError, 'cancelled'):
                ensure(self.payload, self.engine)
        self.legacy()
        self.assertTrue(Path(ensure(self.payload, self.engine)['exe']).exists())

if __name__ == '__main__': unittest.main()
