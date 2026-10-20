"""Prepare model/MTP files using the pinned Strata packers, without auto-tuning."""
import argparse, hashlib, importlib, json, os, pathlib, subprocess, sys
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--model',required=True);p.add_argument('--output',required=True);p.add_argument('--mtp');a=p.parse_args()
source=pathlib.Path(a.source).resolve();output=pathlib.Path(a.output).resolve();model=pathlib.Path(a.model).resolve()
if a.mtp and pathlib.Path(a.mtp).is_file():
 import importlib.util
 spec=importlib.util.spec_from_file_location('dsh_inspector',pathlib.Path(__file__).with_name('inspect-files.py'));inspector=importlib.util.module_from_spec(spec);spec.loader.exec_module(inspector)
 if not inspector.inspect(a.mtp)['mtpImportSupported']:raise ValueError('This MTP GGUF is not supported by the upstream Strata MTP packer. Use a prepared MTP runtime or packed Q2_0 MTP GGUF.')
sys.path.insert(0,str(source));sys.path.insert(0,str(source/'tools'))
os.environ['STRATA_GGUF_PY']=str(source/'third_party/llama.cpp/gguf-py')
from unleashed import split_paths, make_profile
from tools.gguf_reader import GGUFFile
shards=split_paths(model);g=GGUFFile(shards[0]);arch=g.metadata.get('general.architecture')
if arch!='qwen4exp':raise ValueError('The Unleashed import path currently supports qwen4exp / Flash Next. Import another architecture using Strata setup and choose its prepared runtime pack.')
output.mkdir(parents=True,exist_ok=True)
receipt=output/'dsh-import.json'
fingerprint=[(str(f),f.stat().st_size,f.stat().st_mtime_ns) for f in shards]
packer_hash=hashlib.sha256((source/'tools/iq_pack.py').read_bytes()).hexdigest()
expected={'files':fingerprint,'packer':packer_hash}
if not receipt.exists() or json.loads(receipt.read_text())!=json.loads(json.dumps(expected)):
 subprocess.run([sys.executable,'-B',str(source/'tools/iq_pack.py'),'--gguf',str(shards[0]),'--out',str(output),'--compat-bf16'],cwd=source,check=True)
 for name in ['index.txt','dense.bin','native_experts.txt','tokenizer/vocab.json']:
  if not (output/name).is_file():raise FileNotFoundError('Import missing '+name)
 receipt.write_text(json.dumps(expected))
layers=int(g.metadata['qwen4exp.block_count']);experts=int(g.metadata['qwen4exp.expert_count']);profile=output/'expert-profile.bin';make_profile(profile,layers,experts)
result={'modelPath':str(shards[0]),'modelFiles':[str(f) for f in shards],'packPath':str(output),'tokenizerPath':str(output/'tokenizer'),'expertCount':layers*experts,'options':{'--expert-profile':str(profile)}}
if a.mtp:
 mtp=pathlib.Path(a.mtp).resolve()
 if mtp.is_file():
  dest=output/'mtp';subprocess.run([sys.executable,'-B',str(source/'tools/mtp_rt.py'),'--gguf',str(mtp),'--out',str(dest)],cwd=source,check=True);result['mtpPath']=str(dest)
 elif not (mtp/'dense.bin').is_file():raise ValueError('MTP must be a prepared runtime directory or GGUF supported by mtp_rt.py.')
print('DSH_RESULT='+json.dumps(result),flush=True)
