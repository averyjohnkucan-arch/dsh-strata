"""Small synthetic GGUFs cover grouping and failure cases without model downloads."""

from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "python"))
from scanner import scan
from gguf import inspect


def string(value):
    data = value.encode()
    return struct.pack("<Q", len(data)) + data


def gguf(path, metadata=None, tensors=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    metadata = metadata or {}
    tensors = tensors or []
    data = b"GGUF" + struct.pack("<IQQ", 3, len(tensors), len(metadata))
    for key, value in metadata.items():
        data += string(key)
        data += struct.pack("<I", 8 if isinstance(value, str) else 4)
        data += string(value) if isinstance(value, str) else struct.pack("<I", value)
    for index, tensor in enumerate(tensors):
        data += string(tensor) + struct.pack("<IQIQ", 1, 1, 0, index * 4)
    data += b"\0" * ((-len(data)) % 32) + b"\0" * max(4, len(tensors) * 4)
    path.write_bytes(data)
    return path


class ScannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_cross_directory_metadata_shard_and_order(self):
        gguf(
            self.root / "shared" / "abcdef012345-test-00001-of-00003.gguf",
            {"general.architecture": "qwen4exp", "split.count": 3, "split.no": 0},
        )
        gguf(
            self.root / "weights" / "test-00003-of-00003.gguf",
            {"split.count": 3, "split.no": 2},
            ["blk.1.ffn_up_exps.weight"],
        )
        gguf(
            self.root / "weights" / "test-00002-of-00003.gguf",
            {"split.count": 3, "split.no": 1},
            ["per_layer_token_embd.weight"],
        )
        result = scan(self.root)
        self.assertEqual(len(result["models"]), 1)
        model = result["models"][0]
        self.assertEqual(model["status"], "complete")
        self.assertEqual(model["architecture"], "qwen4exp")
        self.assertEqual([f["index"] for f in model["files"]], [1, 2, 3])
        self.assertIn("Engram", model["files"][1]["tensors"])

    def test_selecting_one_shard_finds_its_siblings_and_projector(self):
        first = gguf(self.root / "model-00001-of-00002.gguf", {"split.count": 2, "split.no": 0})
        second = gguf(self.root / "nested" / "model-00002-of-00002.gguf", {"split.count": 2, "split.no": 1})
        gguf(self.root / "another.gguf")
        gguf(self.root / "mmproj.gguf")
        result = scan(self.root, [str(first)])
        self.assertEqual(len(result["models"]), 1)
        self.assertEqual(result["models"][0]["status"], "complete")
        self.assertEqual(len(result["models"][0]["files"]), 2)
        self.assertEqual(result["components"][0]["role"], "Vision")
        self.assertIn(result["components"][0]["id"], result["models"][0]["components"])

    def test_missing_shards_are_explicit(self):
        gguf(
            self.root / "partial-00002-of-00004.gguf", {"split.no": 1, "split.count": 4}
        )
        model = scan(self.root)["models"][0]
        self.assertEqual(model["missing"], [1, 3, 4])
        self.assertEqual(model["status"], "missing")

    def test_independent_copies_are_not_interleaved(self):
        for directory in ("a", "b"):
            gguf(self.root / directory / "same-00001-of-00002.gguf")
            gguf(self.root / directory / "same-00002-of-00002.gguf")
        models = scan(self.root)["models"]
        self.assertEqual(len(models), 2)
        self.assertTrue(
            all(len({Path(f["path"]).parent for f in m["files"]}) == 1 for m in models)
        )

    def test_components_remain_separate(self):
        for name in (
            "model.gguf",
            "model-mtp.gguf",
            "model-engram.gguf",
            "model-dflash.gguf",
            "mmproj.gguf",
        ):
            gguf(self.root / name)
        result = scan(self.root)
        self.assertEqual(len(result["models"]), 1)
        self.assertEqual(
            {c["role"] for c in result["components"]},
            {"MTP", "Engram", "DFlash", "Vision"},
        )

    def test_symlink_cycles_and_duplicate_files(self):
        file = gguf(self.root / "model.gguf")
        (self.root / "alias.gguf").symlink_to(file)
        (self.root / "cycle").symlink_to(self.root, target_is_directory=True)
        self.assertEqual(scan(self.root)["filesScanned"], 1)

    def test_corrupt_file_does_not_hide_good_models(self):
        gguf(self.root / "good.gguf")
        (self.root / "bad.gguf").write_bytes(b"GGUF")
        result = scan(self.root)
        self.assertEqual(len(result["models"]), 1)
        self.assertEqual(len(result["errors"]), 1)

    def test_header_filename_disagreement_is_rejected(self):
        path = gguf(
            self.root / "bad-00001-of-00002.gguf", {"split.no": 1, "split.count": 2}
        )
        with self.assertRaisesRegex(ValueError, "disagree"):
            inspect(path)

    def test_truncated_tensor_payload_is_rejected(self):
        path = gguf(self.root / "bad.gguf", tensors=["blk.0.weight"])
        path.write_bytes(path.read_bytes()[:-4])
        with self.assertRaisesRegex(ValueError, "truncated"):
            inspect(path)

    def test_absolute_folder_required(self):
        with self.assertRaises(ValueError):
            scan("relative")


if __name__ == "__main__":
    unittest.main()
