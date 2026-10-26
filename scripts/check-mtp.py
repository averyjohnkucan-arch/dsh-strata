"""Exercise the external-donor compatibility gate with tiny metadata-only GGUFs."""
import pathlib, struct, subprocess, sys, tempfile

source, output = map(pathlib.Path, sys.argv[1:3])
cpp = output / 'dsh-mtp-check.cpp'
cpp.write_text('''#include "strata/qwen35/mtp_compat.hpp"
#include <cstdio>
int main(int argc, char** argv) {
 if (argc != 3) return 2;
 try { strata::GgufFile a(argv[1]), b(argv[2]); std::string error;
  if (strata::qwen35::external_mtp_compatible(a,b,error)) return 0;
  std::fprintf(stderr,"%s\\n",error.c_str()); return 1;
 } catch (...) { return 2; }
}
''')
exe = output / 'dsh-mtp-check'
subprocess.run(['c++', '-std=c++20', '-O2', '-I'+str(source/'include'), str(cpp), '-o', str(exe)], check=True)
def write(path, metadata):
 def string(s):
  b=s.encode();return struct.pack('<Q',len(b))+b
 data=b'GGUF'+struct.pack('<IQQ',3,0,len(metadata))
 for key,value in metadata.items():
  data+=string(key)
  if isinstance(value,str):data+=struct.pack('<I',8)+string(value)
  elif isinstance(value,list):data+=struct.pack('<IIQ',9,8,len(value))+b''.join(string(v) for v in value)
  else:data+=struct.pack('<II',4,value)
 path.write_bytes(data+b'\0'*((-len(data))%32))
base={'block_count':40,'embedding_length':2048,'attention.head_count':16,'attention.head_count_kv':2,'attention.key_length':256,'attention.value_length':256,'expert_count':256,'expert_used_count':8,'expert_feed_forward_length':512,'expert_shared_feed_forward_length':512,'ssm.conv_kernel':4,'ssm.state_size':128,'ssm.group_count':16,'ssm.time_step_rank':32,'ssm.inner_size':4096,'full_attention_interval':4,'nextn_predict_layers':0}
target={**{'qwen35moe.'+k:v for k,v in base.items()},'general.architecture':'qwen35moe','tokenizer.ggml.tokens':['a','b','c'],'tokenizer.ggml.eos_token_id':2}
donor={**target,'qwen35moe.block_count':41,'qwen35moe.nextn_predict_layers':1}
cases=[('compatible',target,donor,0),('geometry',target,{**donor,'qwen35moe.embedding_length':1024},1),('tokenizer',target,{**donor,'tokenizer.ggml.tokens':['b','a','c']},1),('control token',target,{**donor,'tokenizer.ggml.eos_token_id':1},1),('already embedded',donor,donor,1),('missing draft',target,target,1)]
with tempfile.TemporaryDirectory(dir=output) as folder:
 a,b=pathlib.Path(folder)/'target.gguf',pathlib.Path(folder)/'donor.gguf'
 for name,t,d,expected in cases:
  write(a,t);write(b,d);result=subprocess.run([str(exe),str(a),str(b)],capture_output=True,text=True)
  if result.returncode!=expected:raise RuntimeError(name+': '+result.stderr)
  print('External MTP gate: '+name+' PASS',flush=True)
