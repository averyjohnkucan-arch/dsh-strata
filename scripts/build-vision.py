"""Build the upstream vision reader for CUDA, Vulkan, and CPU independently."""
import argparse,pathlib,subprocess,os,json
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--root',required=True);a=p.parse_args();source=pathlib.Path(a.source);root=pathlib.Path(a.root);result={}
for backend,key in [('cpu','visionCpuExecutable'),('cuda','visionExecutable'),('vulkan','visionIgpuExecutable')]:
 build=root/('vision-'+backend)
 args=['cmake','-S',str(source/'tools/vision'),'-B',str(build),'-G','Ninja','-DCMAKE_BUILD_TYPE=Release','-DLLAMA_DIR='+str(source/'third_party/llama.cpp'),'-DSTRATA_PORTABLE=ON','-DSTRATA_VISION_CUDA='+('ON' if backend=='cuda' else 'OFF'),'-DGGML_VULKAN='+('ON' if backend=='vulkan' else 'OFF')]
 if backend=='cuda':args.append('-DCMAKE_CUDA_ARCHITECTURES=native')
 try:
  subprocess.run(args,check=True);subprocess.run(['cmake','--build',str(build),'--target','strata-vision','--parallel','4'],check=True)
  suffix='.exe' if os.name=='nt' else '';exe=build/'bin'/('strata-vision'+suffix)
  if not exe.exists():raise FileNotFoundError(exe)
  result[key]=str(exe)
 except (OSError,subprocess.CalledProcessError) as e:
  if backend=='cpu':raise
  print(f'{backend} vision unavailable: {e}; CPU fallback retained.',flush=True)
print('DSH_VISION_RESULT='+json.dumps(result))
