import {join} from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {run,gpuInfo} from './process.js';
import {presetDirectory,tuneSettings} from './stock.js';

export function tuneArgs(p,config,source,status,work) {
 const t=tuneSettings(p.autoTune);
 return ['-B',join(source,'strata.py'),'tune','auto',config,'--mode',t.mode,'--goal',t.goal,'--leave-ram',String(t.leaveRam),'--use',t.use,'--name',p.name,'--serve-dir',source,'--work-dir',work,'--status-file',status,'--output','json',...(t.allowSmallDifferences?['--allow-small-differences']:[]),...(t.allowNotRepeatable?['--allow-not-repeatable']:[])];
}
export async function tune(p,runtime,signal,report,{execute=run,readGpu=gpuInfo}={}) {
 if(p.nativeServer)throw new Error('Stock Strata auto-tune requires a Strata model, not a llama-server profile.');
 if(runtime.running.size)throw new Error('Unload managed models before tuning.');
 const t=tuneSettings(p.autoTune),source=await runtime.source(p);
 const work=join(runtime.root,'tuning',p.id);await mkdir(work,{recursive:true});
 const config=join(work,'baseline.json'),status=join(work,'status.json');
 const {cfg}=await runtime.runConfig(p,{checkpoints:false,applyPreset:false,signal});
 await writeFile(config,JSON.stringify(cfg),{mode:0o600});
 const stop=new AbortController();let resolveStopped;const stopped=new Promise(r=>resolveStopped=r);
 let lease,timer,last='';
 const combined=AbortSignal.any([signal,stop.signal]);
 try {
  if(runtime.scheduler)lease=await runtime.scheduler.acquire({key:'strata-tune:'+p.id,name:'Strata auto-tune: '+p.name,gpu:p.gpu,priority:'background',fingerprint:JSON.stringify(p),load:async()=>({}),unload:async()=>{stop.abort();await stopped;},busy:()=>false},combined);
  const gpu=await readGpu(p.gpu);if(gpu.utilization>10||gpu.freePercent<60)throw new Error('GPU is busy. Stock tuning was not started; retry when other GPU work is finished.');
  timer=setInterval(async()=>{try{const progress=JSON.parse(await readFile(status,'utf8'));const message=progress.message||progress.text;if(message&&message!==last){last=message;report(message);}}catch{}},1000);timer.unref?.();
  report(`Stock Strata auto-tune: ${t.mode}, goal ${t.goal}. Upstream measures and saves the preset; this can take ${t.mode==='thorough'?'up to two hours':'about twenty minutes'}.`);
  const result=await execute(p.python||'python3',tuneArgs(p,config,source,status,work),{cwd:source,env:{...p.environment,STRATA_PRESET_DIR:presetDirectory(runtime.root,p)},signal:lease?.signal?AbortSignal.any([combined,lease.signal]):combined,timeout:3*60*60*1000,onData:report});
  combined.throwIfAborted();
  const line=result.stdout.trim().split('\n').findLast(x=>{try{return JSON.parse(x).schema_version===1;}catch{return false;}});
  if(!line)throw new Error('Stock tuner returned no result.');
  const out=JSON.parse(line);if(!out.ok)throw new Error(out.error?.message||'Stock tuning failed.');
  if(!['improved','default_confirmed'].includes(out.result?.outcome))throw new Error(out.result?.message||'Stock tuning did not confirm a usable preset.');
  if(!out.result?.preset?.id)throw new Error('Tuning finished but Strata did not save a usable preset.');
  return out.result;
 } finally {clearInterval(timer);resolveStopped();lease?.release();if(runtime.scheduler&&lease)await runtime.scheduler.unload('strata-tune:'+p.id);}
}
