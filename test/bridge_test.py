"""Adapter contracts for upstream tools; the real GPU tests are recorded separately."""

from pathlib import Path
from unittest.mock import patch
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "python"))
from bridge import prepare, prepare_flash_mtp, stage_files


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.file = self.root / "weights.gguf"
        self.file.write_bytes(b"fixture weight bytes")
        self.model = {
            "status": "complete",
            "architecture": "qwen35moe",
            "files": [{"path": str(self.file), "index": 1, "tensors": {"MTP": 1}}],
        }
        self.profile = {
            "id": "test",
            "model": self.model,
            "context": 2048,
            "port": 8190,
            "gpu": 0,
            "mtp": "",
        }
        self.payload = {
            "profile": self.profile,
            "root": str(self.root / "prepared"),
            "runtime": {"executable": "/engine/strata"},
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_native_tokenizer_contract_and_architecture_are_preserved(self):
        self.model["files"][0]["tensors"] = {}
        with patch("bridge.subprocess.run") as run:
            config = prepare(self.root / "control", self.payload)
        command = run.call_args.args[0]
        output = command[command.index("--out") + 1]
        self.assertEqual(output, str(self.root / "prepared" / "pack"))
        self.assertEqual(config["tokenizer"], output + "/tokenizer")
        self.assertEqual(config["arch"], "qwen35moe")
        self.assertNotIn("--kv", config["args"])
        self.assertNotIn("--spec", config["args"])
        self.assertEqual(self.file.read_bytes(), b"fixture weight bytes")

    def test_flash_next_uses_engine_auto_allocation_without_numeric_tuning_overrides(self):
        self.model["architecture"] = "qwen4exp"
        self.profile["kv"] = "FP16/FP16"
        self.profile["kvArgument"] = "fp16"
        helper = self.root / "helper"
        (helper / "gguf").mkdir(parents=True)
        with patch.dict("bridge.os.environ", {"STRATA_GGUF_PY": str(helper)}), patch("bridge.subprocess.run"):
            config = prepare(self.root / "control", self.payload)
        args = config["args"]
        self.assertEqual(args[args.index("--prefill") + 1], "auto")
        self.assertEqual(args[args.index("--expert-cache") + 1], "auto")
        self.assertEqual(args[args.index("--spec") + 1], "2")
        self.assertNotIn("--pool-workers", args)
        self.assertNotIn("--pcie-frac", args)

    def test_automatic_mtp_uses_strata_tools_and_reuses_completed_runtime(self):
        from unittest.mock import MagicMock
        setup = MagicMock()
        def vocab(stage, _choice):
            (stage / "draft_vocab.bin").write_bytes(b"vocab")
        setup.refresh_draft_vocab.side_effect = vocab
        def execute(command, **_kwargs):
            output = Path(command[command.index("--out") + 1])
            if command[2].endswith("mtp_pack.py"):
                output.write_bytes(b"packed")
            else:
                for name in ("experts.bin", "dense.bin", "dense.txt"):
                    (output / name).write_bytes(b"draft")
        root = self.root / "shared-mtp"
        with patch("bridge.setup_module", return_value=setup), patch("bridge.subprocess.run", side_effect=execute) as run:
            runtime = prepare_flash_mtp(self.root / "control", root)
            self.assertTrue((runtime / "draft_vocab.bin").is_file())
            self.assertEqual(run.call_count, 2)
            self.assertEqual(prepare_flash_mtp(self.root / "control", root), runtime)
            self.assertEqual(run.call_count, 2)
            setup.fetch_mtp.assert_called_once()

    def test_external_native_mtp_is_rejected_before_any_conversion(self):
        self.profile["mtp"] = "/unsupported-mtp.gguf"
        with (
            patch("bridge.subprocess.run") as run,
            self.assertRaisesRegex(ValueError, "embedded"),
        ):
            prepare(self.root / "control", self.payload)
        run.assert_not_called()

    def test_native_embedded_mtp_uses_strata_family_setting(self):
        from unittest.mock import MagicMock
        setup = MagicMock()
        setup.OWN_PATH_FAMILIES = {"qwen36": {"mtp": 2}}
        with patch("bridge.subprocess.run"), patch("bridge.setup_module", return_value=setup):
            config = prepare(self.root / "control", self.payload)
        args = config["args"]
        self.assertEqual(args[args.index("--mtp") + 1], "2")

    def test_missing_shards_fail_before_staging(self):
        self.model["status"] = "missing"
        with self.assertRaisesRegex(ValueError, "missing"):
            prepare(self.root / "control", self.payload)
        self.assertFalse((self.root / "prepared").exists())

    def test_staging_reuses_links_and_refuses_changed_sources(self):
        stage = self.root / "stage"
        first = stage_files(self.model, stage)
        self.assertTrue(first.is_symlink())
        self.assertEqual(stage_files(self.model, stage), first)
        other = self.root / "other" / "weights.gguf"
        other.parent.mkdir()
        other.write_bytes(b"different")
        self.model["files"][0]["path"] = str(other)
        with self.assertRaisesRegex(ValueError, "different"):
            stage_files(self.model, stage)

class DownloadTests(unittest.TestCase):
    def test_setup_dispatch_is_catalog_checked_and_does_not_start_inference(self):
        from bridge import download
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'model'
            selection = {'family': 'qwen', 'model': 'IQ3_S'}
            def setup(command, **kwargs):
                self.assertIn('--no-start', command)
                self.assertIn('--no-browser', command)
                self.assertIn('--yes', command)
                self.assertEqual(kwargs['env']['STRATA_INSTALL_DIR'], str(root))
                (root / 'strata-model.json').write_text('{"exe":"component:strata-engine","args":[]}')
            with patch('bridge.catalog', return_value=[selection]), patch('bridge.subprocess.run', side_effect=setup):
                result = download(Path('/control'), {'selection': selection, 'root': str(root)})
            self.assertEqual(result['config']['exe'], 'component:strata-engine')

    def test_unknown_selection_is_rejected_before_creating_directories(self):
        from bridge import download
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'never-created'
            with patch('bridge.catalog', return_value=[]), self.assertRaisesRegex(ValueError, 'catalog'):
                download(Path('/control'), {'selection': {'family': '../escape', 'model': 'bad'}, 'root': str(root)})
            self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()
