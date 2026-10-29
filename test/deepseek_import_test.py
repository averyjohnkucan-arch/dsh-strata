"""Native local-setup contracts without downloading model weights."""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "python"))
from deepseek_import import prepare, selection
from bridge import prepare as bridge_prepare
from scanner import compatibility

class DeepSeekImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / 'source-model'
        self.folder.mkdir()
        self.shards = ['model-00001-of-00002.gguf', 'model-00002-of-00002.gguf']
        self.setup = SimpleNamespace(
            MULTI_FILE_FAMILIES={'deepseek41': {'models': {'IST-DAS-2.00bpw': {'shards': self.shards, 'shared': ['engram.gguf']}}}},
            DSV41_LEGACY_NAMES={self.shards[0]: 'legacy-1.gguf', self.shards[1]: 'legacy-2.gguf'},
            dsv41_find_shared=lambda *args: self.folder / 'engram.gguf',
        )
        for name in self.shards + ['engram.gguf']:
            (self.folder / name).write_bytes(b'original data')
        self.profile = {'id': 'deepseek', 'model': {'architecture': 'deepseek41', 'status': 'complete',
            'files': [{'path': str(self.folder/name), 'index': i+1} for i,name in enumerate(self.shards)]},
            'context': 1048576, 'gpu': 0, 'port': 8190}
        shared = patch("deepseek_runtime.ensure", return_value={"exe": "/shared/strata-dsv41", "lib_dirs": ["/shared"]})
        self.shared_runtime = shared.start()
        self.addCleanup(shared.stop)
        self.payload = {'root': str(self.root/'prepared'), 'profile': self.profile,
                        'runtime': {'executable': '/qwen/strata'}}
        staged = self.root/'prepared/shards'; staged.mkdir(parents=True)
        for name in self.shards: (staged/name).symlink_to(self.folder/name)

    def test_selects_complete_native_catalog_set_and_legacy_names(self):
        self.assertEqual(selection(self.setup, self.profile['model']['files'])[0], 'IST-DAS-2.00bpw')
        legacy=[{'path':name} for name in self.setup.DSV41_LEGACY_NAMES.values()]
        self.assertEqual(selection(self.setup, legacy)[0], 'IST-DAS-2.00bpw')
        with self.assertRaisesRegex(ValueError,'complete'):
            selection(self.setup, legacy[:1])
        with self.assertRaisesRegex(ValueError,'supported'):
            selection(self.setup, [{'path':'different.gguf'}])

    def test_native_setup_reuses_components_and_retries_without_counting_them_as_shards(self):
        def run(command, **options):
            self.assertEqual(command[command.index('--family')+1], 'deepseek41')
            self.assertEqual(command[command.index('--model')+1], 'IST-DAS-2.00bpw')
            self.assertEqual(command[command.index('--context')+1], '1048576')
            self.assertIn('--gguf-dir', command)
            self.assertIn('--no-start', command)
            self.assertEqual(options['env']['STRATA_DSV41_NO_SMOKE'], '1')
            self.assertEqual(options['env']['STRATA_DSV41_EXE'], '/shared/strata-dsv41')
            self.assertTrue(options['check'])
            root=Path(options['env']['STRATA_INSTALL_DIR'])
            (root/'strata-deepseek.json').write_text(json.dumps({'arch':'deepseek41','exe':'/deepseek/strata-dsv41','args':['--pack','/pack'], 'lib_dirs':['/deepseek/private']}))
        for _ in range(2):
            with patch('deepseek_import.subprocess.run',side_effect=run):
                config=prepare(self.root,self.payload,self.setup)
            self.assertEqual(config['lib_dirs'], ['/deepseek/private'])
            self.assertEqual(config['model_name'], 'deepseek')
            self.assertEqual(config['host'],'127.0.0.1')
            self.assertTrue((self.root/'prepared/shards/engram.gguf').is_symlink())
            self.assertEqual((self.folder/'engram.gguf').read_bytes(),b'original data')

    def test_bridge_dispatches_deepseek_before_qwen_packing(self):
        with patch('bridge.setup_module',return_value=self.setup), patch('deepseek_import.prepare',return_value={'arch':'deepseek41'}) as native:
            self.assertEqual(bridge_prepare(self.root,self.payload), {'arch':'deepseek41'})
            native.assert_called_once()

    def test_explicit_custom_runtime_is_not_replaced_by_shared_engine(self):
        self.payload['runtime']['executable'] = '/custom/strata-dsv41'
        def run(command, **options):
            self.assertEqual(options['env']['STRATA_DSV41_EXE'], '/custom/strata-dsv41')
            root=Path(options['env']['STRATA_INSTALL_DIR'])
            (root/'strata-deepseek.json').write_text(json.dumps({'arch':'deepseek41','exe':'/custom/strata-dsv41'}))
        with patch('deepseek_import.subprocess.run',side_effect=run):
            prepare(self.root,self.payload,self.setup)
        self.shared_runtime.assert_not_called()

    def test_native_failure_does_not_return_an_unprepared_configuration(self):
        with patch('deepseek_import.subprocess.run',side_effect=RuntimeError('cancelled')):
            with self.assertRaisesRegex(RuntimeError,'cancelled'):
                prepare(self.root,self.payload,self.setup)
        self.assertEqual((self.folder/self.shards[0]).read_bytes(),b'original data')

    def test_scanner_admits_deepseek_to_native_validation_only(self):
        self.assertIsNone(compatibility(self.profile['model']))
        self.assertIn('unavailable', compatibility({'architecture':'unknown'}))

if __name__ == '__main__': unittest.main()
