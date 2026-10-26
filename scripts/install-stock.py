"""Install checksum-pinned stock Strata packages into the plugin's data directory."""
import argparse, hashlib, json, pathlib, platform, shutil, subprocess, tarfile, tempfile, urllib.request

PKG=pathlib.Path(__file__).resolve().parents[1]
def digest(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def unpack(archive, dest):
 with tarfile.open(archive) as tf:tf.extractall(dest,filter='data')

def install(root, variant='auto', cache=None):
 if platform.system()!='Linux' or platform.machine()!='x86_64':
  raise RuntimeError('Automatic installation currently supports Linux x86-64 NVIDIA. Install official Strata for your platform and select its runtime paths in the plugin.')
 if variant=='auto':
  driver=subprocess.check_output(['nvidia-smi','--query-gpu=driver_version','--format=csv,noheader'],text=True).splitlines()[0]
  variant='cuda13' if int(driver.split('.')[0])>=580 else 'cuda12'
 meta=json.loads((PKG/'lib/engine.json').read_text())
 cache=pathlib.Path(cache or root/'downloads');cache.mkdir(parents=True,exist_ok=True)
 def package(name, marker, dest):
  asset=meta['assets'][name];archive=cache/name
  if not archive.exists() or digest(archive)!=asset['sha256']:
   tmp=archive.with_suffix('.partial')
   print('Downloading official '+name,flush=True)
   if shutil.which('aria2c'):
    subprocess.run(['aria2c','-x','4','-s','4','--continue=true','--auto-file-renaming=false','--console-log-level=warn','--summary-interval=30','-d',str(cache),'-o',tmp.name,asset['url']],check=True)
   else:
    with urllib.request.urlopen(asset['url'],timeout=120) as src,tmp.open('wb') as out:shutil.copyfileobj(src,out)
   if digest(tmp)!=asset['sha256']:raise RuntimeError('Release checksum mismatch: '+name)
   tmp.replace(archive)
  if dest.exists():
   stamp=dest/'.dsh-archive-sha256'
   if stamp.exists() and stamp.read_text()==asset['sha256']:return dest
   raise RuntimeError('Existing installation is not this verified release: '+str(dest))
  dest.parent.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='.stock-',dir=dest.parent) as stage:
   stage=pathlib.Path(stage);unpack(archive,stage)
   found=list(stage.rglob(marker))
   if len(found)!=1:raise RuntimeError('Unexpected release layout: '+name)
   folder=found[0].parent
   (folder/'.dsh-archive-sha256').write_text(asset['sha256'])
   folder.rename(dest)
  return dest
 control=package('strata-control-0.1.51-linux-x86_64.tar.gz','strata.py',root/'stock-control-0.1.51')
 engine=package(f'strata-engine-0.1.50-linux-x86_64-cuda-{variant}.tar.gz','engine-component.json',root/f'stock-engine-0.1.50-{variant}')
 python=control/'python/bin/python3'
 subprocess.run([str(python),'-B','-c','import jinja2, regex, numpy, yaml; print("Stock runtime dependencies OK")'],cwd=control,check=True)
 receipt={'engineFlavor':'stock','engineRelease':meta['release'],'sourceDir':str(control),'executable':str(engine/'strata'),'python':str(python),'visionExecutable':str(engine/'strata-vision'),'visionCpuExecutable':str(engine/'strata-vision')}
 subprocess.run([str(engine/'strata'),'--version'],check=True)
 tmp=root/'stock-install.json.tmp';tmp.write_text(json.dumps(receipt,indent=2));tmp.replace(root/'stock-install.json')
 print('DSH_RESULT='+json.dumps(receipt),flush=True)
 return receipt

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,default=PKG/'.engine');p.add_argument('--variant',choices=['auto','cuda12','cuda13'],default='auto');p.add_argument('--cache',type=pathlib.Path);a=p.parse_args()
 install(a.root.resolve(),a.variant,a.cache)
