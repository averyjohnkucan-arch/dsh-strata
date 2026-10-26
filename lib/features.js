import {stockKv} from './stock.js';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const featureCatalog = [
 {id:'kvQ6',label:'Flash-Next Q6 KV',help:'Enables Q6/Q6, Q8/Q6, Q6/Q8 and FP16/Q6. Requires an optional CUDA build. Lower precision reduces KV memory and may change output.'},
 {id:'kvQ5',label:'Flash-Next Q5 KV',help:'Enables Q8/Q5, Q5/Q5 and Q5/Q4. Requires an optional CUDA build. This changes KV precision, not model weights.'},
 {id:'kvMixed',label:'Flash-Next FP16/Q8 KV',help:'Keeps keys in FP16 and values in Q8. Uses the shared optional mixed-format kernels. Stock Q8/Q4 remains available without this extension.'},
 {id:'qwenInt8Kv',label:'Qwen3.6 INT8 KV',help:'Adds INT8 K/V to the native Qwen3.6 35B A3B driver. Stock uses FP32 KV. This extension does not add Qwen checkpoint serialization.'},
 {id:'externalMtp',label:'Qwen3.6 external MTP donor',help:'Allows an explicitly selected, compatible draft GGUF for a target without embedded MTP. The target verifies draft proposals. Geometry and tokenizer must match.'}
];
export function features(value={}) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Engine extensions must be an object.');
 for(const [k,v] of Object.entries(value))if(!featureCatalog.some(f=>f.id===k)||typeof v!=='boolean')throw new Error('Unknown or invalid engine extension: '+k);
 return Object.fromEntries(featureCatalog.map(f=>[f.id,value[f.id]===true]));
}
export function patchNames(value) {
 const f=features(value);
 return [...(f.kvQ6||f.kvQ5||f.kvMixed?['flash-kv-formats.patch']:[]),...(f.qwenInt8Kv?['qwen-int8-kv.patch']:[]),...(f.externalMtp?['qwen-external-mtp.patch']:[])];
}
export function kvPairs(profile) {
 const f=features(profile.extensions);
 if(profile.architecture==='qwen35moe')return ['FP32/FP32',...(f.qwenInt8Kv?['Q8/Q8']:[])];
 return [...Object.keys(stockKv),...(f.kvQ6?['Q6/Q6','Q8/Q6','Q6/Q8','FP16/Q6']:[]),...(f.kvQ5?['Q8/Q5','Q5/Q5','Q5/Q4']:[]),...(f.kvMixed?['FP16/Q8']:[])];
}
export function validateKv(profile) {
 const pair=profile.kvK+'/'+profile.kvV;
 if(!kvPairs(profile).includes(pair))throw new Error('Unsupported KV pair '+pair+'. Enable its optional feature or choose '+kvPairs(profile).join(', ')+'.');
 return profile.architecture==='qwen35moe'?(pair==='Q8/Q8'?'int8':null):(stockKv[pair]||pair);
}
export const qwenFlags=['--model','--native','--max-new','--no-token-graph','--pool-workers','--gpu','--greedy','--serve','--max-context','--ctx','--chunk','--prefill','--tokens','--n','--force','--emb','--dump-full-logits','--bench-pp','--bench-tg','--no-graph','--no-warmup','--mtp','--draft-vocab','--vision','--batch','--slots','--batch-mtp','--expert-vram','--cpu-threads','--expert-slots','--hybrid-rows'];
/** Validate the final argv, including presets and advanced overrides. */
export function validateLaunchArgs(p,args,env={}) {
 const flags=new Map();for(let i=0;i<args.length;i++){const a=String(args[i]);if(!a.startsWith('--'))continue;const eq=a.indexOf('=');const flag=eq<0?a:a.slice(0,eq);flags.set(flag,eq<0?(args[i+1]!=null&&!String(args[i+1]).startsWith('--')?args[++i]:true):a.slice(eq+1));}
 const ext=features(p.extensions),qwen=p.architecture==='qwen35moe';
 if(qwen){
  const allowed=new Set([...qwenFlags,...(ext.qwenInt8Kv?['--kv','--tokens-file']:[]),...(ext.externalMtp?['--mtp-model']:[])]);
  for(const flag of flags.keys())if(!allowed.has(flag))throw new Error('Stock Qwen3.6 does not support '+flag+' with these extensions.');
 }
 const raw=flags.get('--kv'),pair=raw===undefined?(qwen?'FP32/FP32':'FP16/FP16'):(Object.entries(stockKv).find(([,v])=>v===raw)?.[0]||raw);
 validateKv({...p,kvK:String(pair).split('/')[0],kvV:String(pair).split('/')[1]});
 if(!qwen&&String(raw).includes('/')){
  if(p.kvCache!==false)throw new Error('Optional mixed KV requires disk checkpoints disabled.');
  if(Number(flags.get('--conversation-cache-mib')||0)>0||flags.has('--kv-grow')||env.STRATA_KV_GROW==='1')throw new Error('Mixed KV cannot use parked conversation cache or elastic KV growth.');
 }
 if(flags.has('--mtp-model')&&!ext.externalMtp)throw new Error('Enable the external MTP extension first.');
 return args;
}
export async function extensionKey(value) {
 const meta=JSON.parse(await readFile(new URL('./engine.json',import.meta.url),'utf8'));
 const patches={};for(const name of patchNames(value).sort())patches[name]=createHash('sha256').update(await readFile(new URL('../patches/'+name,import.meta.url))).digest('hex');
 // Matches Python's sorted-key, spaced JSON serialization in build-extensions.py.
 const pairs=Object.entries(patches).map(([k,v])=>JSON.stringify(k)+': '+JSON.stringify(v)).join(', ');
 return createHash('sha256').update('{"patches": {'+pairs+'}, "revision": '+JSON.stringify(meta.revision)+'}').digest('hex').slice(0,20);
}
