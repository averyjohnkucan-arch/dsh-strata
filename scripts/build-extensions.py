"""Build opt-in engine patches on an isolated, pinned stock source checkout."""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile

PKG=pathlib.Path(__file__).resolve().parents[1]
ALLOWED={'flash-kv-formats.patch','qwen-int8-kv.patch','qwen-external-mtp.patch'}
def build(root, patches, jobs=4, prepare_only=False):
 meta=json.loads((PKG/'lib/engine.json').read_text())
 if not patches or set(patches)-ALLOWED:raise ValueError('Select a supported patch set.')
 patches=sorted(set(patches))
 inputs={'revision':meta['revision'],'patches':{p:hashlib.sha256((PKG/'patches'/p).read_bytes()).hexdigest() for p in patches}}
 key=hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest()[:20]
 base=root/'extensions'/key;source=base/'source';output=base/'build';receipt=base/'receipt.json'
 arch=None
 if not prepare_only:
  gpu=os.environ.get('CUDA_VISIBLE_DEVICES','0').split(',')[0]
  capability=subprocess.check_output(['nvidia-smi','--id='+gpu,'--query-gpu=compute_cap','--format=csv,noheader'],text=True).strip()
  if not re.fullmatch(r'\d+\.\d+',capability):raise RuntimeError('Cannot determine the selected GPU compute capability.')
  arch=capability.replace('.','')
 if receipt.exists():
  result=json.loads(receipt.read_text())
  if result.get('cudaArchitecture')==arch and pathlib.Path(result['executable']).is_file() and hashlib.sha256(pathlib.Path(result['executable']).read_bytes()).hexdigest()==result['sha256']:
   print('DSH_RESULT='+json.dumps(result),flush=True);return result
 if not source.exists():
  base.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='prepare-',dir=base) as tmp:
   stage=pathlib.Path(tmp)/'source'
   subprocess.run(['git','clone','--depth','1','--branch',meta['release'],meta['source'],str(stage)],check=True)
   actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=stage,text=True).strip()
   if actual!=meta['revision']:raise RuntimeError('Upstream tag changed; expected the pinned source revision.')
   for p in patches:subprocess.run(['git','apply','--check',str(PKG/'patches'/p)],cwd=stage,check=True);subprocess.run(['git','apply',str(PKG/'patches'/p)],cwd=stage,check=True)
   (stage/'.dsh-patches.json').write_text(json.dumps(inputs,sort_keys=True))
   stage.rename(source)
 if json.loads((source/'.dsh-patches.json').read_text())!=inputs:raise RuntimeError('Extension source identity mismatch.')
 if prepare_only:return {'source':str(source),'key':key}
 cmake=shutil.which('cmake');nvcc=shutil.which('nvcc')
 if not nvcc:
  cuda=pathlib.Path(os.environ.get('CUDA_HOME',os.environ.get('CUDA_PATH','/usr/local/cuda')));nvcc=str(cuda/'bin/nvcc') if (cuda/'bin/nvcc').is_file() else None
 if not cmake or not nvcc:raise RuntimeError('Optional extensions require CMake 3.24+, a C++20 compiler and CUDA toolkit (nvcc). Install them or configure PATH/CUDA_HOME, then retry. The official stock runtime is unchanged.')
 pin=(source/'third_party/ggml/VERSION.txt').read_text().split()[0]
 if not re.fullmatch('[0-9a-f]{40}',pin):raise RuntimeError('Invalid upstream GGML revision.')
 ggml=root/'dependencies'/pin
 if not (ggml/'ggml/CMakeLists.txt').is_file():
  ggml.parent.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='ggml-',dir=ggml.parent) as tmp:
   subprocess.run(['git','init','-q',tmp],check=True)
   subprocess.run(['git','fetch','--depth','1','https://github.com/ggml-org/llama.cpp.git',pin],cwd=tmp,check=True)
   subprocess.run(['git','checkout','--detach','FETCH_HEAD'],cwd=tmp,check=True)
   pathlib.Path(tmp).rename(ggml)
 if subprocess.check_output(['git','rev-parse','HEAD'],cwd=ggml,text=True).strip()!=pin:raise RuntimeError('GGML revision mismatch.')
 print('Building optional extensions: '+', '.join(patches),flush=True)
 # Explicit numeric architecture lets upstream map Blackwell's W4A4 unit to sm_120a.
 subprocess.run([cmake,'-S',str(source),'-B',str(output),'-DCMAKE_BUILD_TYPE=Release','-DSTRATA_ENABLE_CUDA=ON','-DSTRATA_PORTABLE=ON','-DSTRATA_BUILD_TESTS=ON','-DSTRATA_BUILD_CONVERSATION_TESTS=ON','-DCMAKE_CUDA_ARCHITECTURES='+arch,'-DCMAKE_CUDA_COMPILER='+nvcc,'-DSTRATA_GGML_DIR='+str(ggml)],check=True)
 targets=['strata','model_family_test']
 if 'flash-kv-formats.patch' in patches:targets+=['kv_mixed_parity','kv_stream_parity','conversation_validation_test']
 # nvcc's implicit -L reporting can truncate toolkit paths containing spaces.
 # GCC's search-path environment preserves each complete colon-separated path.
 build_env=os.environ.copy();cuda_lib=pathlib.Path(nvcc).resolve().parents[1]/'targets/x86_64-linux/lib'
 if cuda_lib.is_dir():build_env['LIBRARY_PATH']=str(cuda_lib)+os.pathsep+build_env.get('LIBRARY_PATH','')
 subprocess.run([cmake,'--build',str(output),'--parallel',str(jobs),'--target',*targets],check=True,env=build_env)
 # Each enabled implementation must pass its packaged regression gates before activation.
 subprocess.run([str(output/'model_family_test')],check=True)
 if 'qwen-external-mtp.patch' in patches:subprocess.run([os.sys.executable,str(PKG/'scripts/check-mtp.py'),str(source),str(output)],check=True)
 for target in targets[2:]:subprocess.run([str(output/target)],check=True,env={**os.environ,**({'CUDA_VISIBLE_DEVICES':'-1'} if target=='conversation_validation_test' else {})})
 exe=output/'strata';result={**inputs,'key':key,'cudaArchitecture':arch,'executable':str(exe),'sha256':hashlib.sha256(exe.read_bytes()).hexdigest()}
 tmp=receipt.with_suffix('.tmp');tmp.write_text(json.dumps(result,indent=2));tmp.replace(receipt)
 print('DSH_RESULT='+json.dumps(result),flush=True);return result

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=pathlib.Path);p.add_argument('--patch',action='append',required=True,choices=sorted(ALLOWED));p.add_argument('--jobs',type=int,default=4);p.add_argument('--prepare-only',action='store_true');a=p.parse_args()
 if not 1<=a.jobs<=32:p.error('--jobs must be 1..32')
 build(a.root.resolve(),a.patch,a.jobs,a.prepare_only)
