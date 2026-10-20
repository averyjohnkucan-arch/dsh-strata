import importlib.util,pathlib,tempfile,struct,unittest
spec=importlib.util.spec_from_file_location('reader',pathlib.Path(__file__).parents[1]/'scripts/inspect-files.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def gguf(path,metadata,tensors):
 def string(s):b=s.encode();return struct.pack('<Q',len(b))+b
 data=b'GGUF'+struct.pack('<IQQ',3,len(tensors),len(metadata))
 for k,v in metadata.items():data+=string(k)+(struct.pack('<I',8)+string(v) if isinstance(v,str) else struct.pack('<II',4,v))
 for name in tensors:data+=string(name)+struct.pack('<IQIQ',1,1,0,0)
 path.write_bytes(data)
class TestSelection(unittest.TestCase):
 def test_model_shards_projector_mtp_and_symlink(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);paths=[]
   for i in range(1,4):
    p=root/f'model-{i:05}-of-00003.gguf';gguf(p,{'general.architecture':'qwen4exp','split.count':3,'split.no':i-1},['blk.0.attn_q.weight']);paths.append(p)
   external=root/'real-ple.gguf';paths[1].rename(external);paths[1].symlink_to(external)
   projector=root/'mmproj.gguf';gguf(projector,{'general.architecture':'clip'},['v.blk.0.weight'])
   mtp=root/'mtp.gguf';gguf(mtp,{'general.architecture':'qwen4exp','strata.mtp.expert_format':'q2_0'},['mtp.layers.0.weight'])
   r=m.assign(list(map(str,[*reversed(paths),projector,mtp])))
   self.assertTrue(r['complete']);self.assertEqual(r['assignments']['modelFiles'],list(map(str,paths)));self.assertEqual(r['assignments']['projectorPath'],str(projector));self.assertEqual(r['assignments']['mtpPath'],str(mtp))
 def test_missing_shards_and_ambiguous_models(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);a=root/'model-00001-of-00003.gguf';gguf(a,{'general.architecture':'qwen4exp'},['blk.0.attn_q.weight']);r=m.assign([str(a)]);self.assertFalse(r['complete']);self.assertIn('2, 3',r['warnings'][0]);b=root/'another.gguf';gguf(b,{'general.architecture':'qwen4exp'},['blk.0.attn_q.weight']);self.assertRaisesRegex(ValueError,'more than one',m.assign,[str(a),str(b)])
 def test_incompatible_mtp_is_detected_before_conversion(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'mtp.gguf';gguf(p,{'general.architecture':'qwen4exp'},['mtp.layers.0.weight']);r=m.assign([str(p)]);self.assertFalse(r['complete']);self.assertIn('not the packed Q2_0',r['warnings'][0])
if __name__=='__main__':unittest.main()
