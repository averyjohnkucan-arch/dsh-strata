import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { gpuInfo } from './process.js';
const PAIRS=['FP16/FP16','FP16/Q8','FP16/Q6','Q8/Q8','Q8/Q6','Q8/Q5','Q6/Q6','Q5/Q5','Q5/Q4','Q4/Q4'];
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const locked=(p,key)=>p.locks.includes(key);
export function applyCandidate(profile, changes) {
 const p=structuredClone(profile);p.tuned={...p.tuned,options:{...p.tuned?.options}};
 for(const [key,value] of Object.entries(changes)){
  if(key.startsWith('options.')){if(!locked(p,key))p.tuned.options[key.slice(8)]=value;}
  else if(!locked(p,key))p.tuned[key]=value;
 }
 return p;
}
export async function binaryBoundary({low,high,step=1,probe,acceptable}) {
 let best=null;const visited=new Map();
 while(low<=high){const value=Math.floor((low+high)/2/step)*step;if(visited.has(value))break;const result=await probe(value);visited.set(value,result);if(acceptable(result)){best={value,result};low=value+step;}else high=value-step;}
 // Neighbor checks limit reliance on monotonic allocator behavior.
 if(best)for(const value of [best.value-step,best.value+step])if(value>=0&&!visited.has(value)){const result=await probe(value);visited.set(value,result);if(acceptable(result)&&value>best.value)best={value,result};}
 return{best,visited:[...visited.entries()]};
}
async function completion(url,model,promptTokens,outputTokens,signal) {
 const nonce=crypto.randomUUID();
 // Usage from the engine, rather than this approximate prompt size, drives reported rates.
 const prompt=`${nonce}\n`+'Read this sequence and summarize it briefly. '.repeat(Math.max(1,Math.ceil(promptTokens/9)));
 const start=performance.now();let first=null,last=null,usage=null,visible=0,buffer='';
 const response=await fetch(url+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0,max_tokens:outputTokens,stream:true,stream_options:{include_usage:true},chat_template_kwargs:{enable_thinking:false}})});
 if(!response.ok)throw new Error(`Benchmark request failed (${response.status}): ${(await response.text()).slice(-2000)}`);
 const decoder=new TextDecoder();
 for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);if(!line.startsWith('data:')||line==='data: [DONE]')continue;const item=JSON.parse(line.slice(5));if(item.error)throw new Error(JSON.stringify(item.error));if(item.usage)usage=item.usage;const delta=item.choices?.[0]?.delta;if(delta?.content||delta?.reasoning_content){first??=performance.now();last=performance.now();visible++;}}}
 if(!first||!usage?.completion_tokens||!usage?.prompt_tokens)throw new Error('Engine must return streamed tokens and actual prompt/completion usage for measured tuning.');
 return{decode:Math.max(1,usage.completion_tokens-1)/Math.max((last-first)/1000,0.001),prefill:usage.prompt_tokens/Math.max((first-start)/1000,0.001),promptTokens:usage.prompt_tokens,completionTokens:usage.completion_tokens};
}
export async function evaluate(p,runtime,signal,{prefill=false,full=false}={}) {
 await runtime.stop(p.id);const policy=p.tunePolicy;let minimumFree=Infinity,timer,lease;
 try{
  lease=await runtime.acquire(p,signal,{priority:'background',reuseExisting:false});const state=lease.state;
  const sample=async()=>{const g=await gpuInfo(p.gpu);minimumFree=Math.min(minimumFree,g.freePercent);};await sample();
  let sampling=Promise.resolve();timer=setInterval(()=>{sampling=sampling.then(sample).catch(()=>{});},200);
  const rates=[];
  for(let i=0;i<policy.repeats;i++){signal.throwIfAborted();rates.push(await completion(state.url,p.id,full?Math.max(512,p.context-policy.outputTokens-64):prefill?policy.prefillTokens:policy.promptTokens,policy.outputTokens,AbortSignal.any([signal,...(lease.signal?[lease.signal]:[]),AbortSignal.timeout(policy.timeoutMs)])));}
  clearInterval(timer);timer=undefined;await sampling;await sample();
  return{ok:true,decode:median(rates.map(x=>x.decode)),prefill:median(rates.map(x=>x.prefill)),freePercent:minimumFree,rates};
 }catch(e){if(signal.aborted||lease?.signal?.aborted)throw e;return{ok:false,error:e.message,freePercent:minimumFree===Infinity?0:minimumFree};}
 finally{clearInterval(timer);lease?.release();await runtime.stop(p.id);await delay(350,undefined,{signal});}
}
export async function tune(original,runtime,signal,report,{evaluator=evaluate,gpuReader=gpuInfo}={}) {
 if(original.extraArgs.length)throw new Error('Move raw extra arguments into the structured controls before tuning, so manual locks can be enforced.');
 if(runtime.running.size)throw new Error('Stop managed models before tuning.');
 const gpu=await gpuReader(original.gpu);
 if(gpu.freePercent<60||gpu.utilization>10)throw new Error(`GPU is busy (${gpu.freePercent.toFixed(1)}% free). Stop other inference workloads before tuning; no external process was stopped.`);
 const policy={residentPercent:80,reserveLow:6,reserveHigh:10,finalReserveLow:0.7,finalReserveHigh:1.5,maxDecodeLoss:5,maxTrials:80,repeats:3,...original.tunePolicy};
 if(policy.repeats<1||policy.maxTrials<1||policy.maxDecodeLoss<0||policy.maxDecodeLoss>5)throw new Error('Invalid tuning policy. Decode loss must be between 0 and 5%.');
 let p=structuredClone(original);p.tunePolicy=policy;const trials=[];let count=0;
 const probe=async(candidate,stage,flags={})=>{signal.throwIfAborted();if(++count>policy.maxTrials)throw new Error('Trial budget reached. No new tune was saved; increase the trial budget or narrow the unlocked settings.');report(`${stage} · trial ${count}/${policy.maxTrials}`);const result=await evaluator(candidate,runtime,signal,flags);trials.push({stage,changes:structuredClone(candidate.tuned),result});return result;};
 const vision=gpu.totalMiB<=12*1024?(p.visionGpuIndex&&p.visionExecutable?'igpu':'cpu'):'gpu';
 p=applyCandidate(p,{visionDevice:p.projectorPath?vision:'off',residentMode:'percent',residentPercent:policy.residentPercent,'options.--expert-cache':0});
 // MTP stays loaded on the text GPU whenever a runtime was supplied; the tuner never disables it.
 const fixedK=locked(p,'kvK')?p.kvK:null,fixedV=locked(p,'kvV')?p.kvV:null;
 const pairs=PAIRS.filter(pair=>(!fixedK||pair.split('/')[0]===fixedK)&&(!fixedV||pair.split('/')[1]===fixedV));
 if(!pairs.length)throw new Error('Manual K/V selections do not form a supported Strata pair.');
 const exploration=['FP16/FP16','Q4/Q4','Q8/Q8',...pairs].filter((pair,i,a)=>pairs.includes(pair)&&a.indexOf(pair)===i);
 let selected=null;
 for(const pair of exploration){const[k,v]=pair.split('/');const candidate=applyCandidate(p,{kvK:k,kvV:v});const result=await probe(candidate,`KV ${pair}`);if(result.ok&&result.freePercent>=policy.reserveLow){if(!selected||PAIRS.indexOf(pair)<PAIRS.indexOf(selected.pair))selected={profile:candidate,result,pair};}if(pair==='FP16/FP16'&&selected)break;}
 // If 80% residency cannot fit, search context cells with all manual choices frozen.
 if(!selected&&!locked(p,'residentMode')&&!locked(p,'residentContext')&&!locked(p,'residentPercent')){
  for(const pair of pairs){const[k,v]=pair.split('/');const base=applyCandidate(p,{kvK:k,kvV:v,residentMode:'context'});const boundary=await binaryBoundary({low:Math.min(20480,p.context),high:Math.floor(p.context*policy.residentPercent/100),step:256,probe:value=>probe(applyCandidate(base,{residentContext:value}),`Resident KV ${pair}`),acceptable:r=>r.ok&&r.freePercent>=policy.reserveLow});if(boundary.best){selected={profile:applyCandidate(base,{residentContext:boundary.best.value}),result:boundary.best.result,pair};break;}}
 }
 if(!selected)throw new Error('No supported unlocked KV configuration fits the initial VRAM reserve. Locked fields were preserved.');
 p=selected.profile;let best=selected.result;
 // Fill toward the initial 6–10% reserve with resident KV, then experts are filled last.
 if(best.freePercent>policy.reserveHigh&&!locked(p,'residentMode')&&!locked(p,'residentContext')&&!locked(p,'residentPercent')){
  const base=applyCandidate(p,{residentMode:'context'});const boundary=await binaryBoundary({low:Math.min(20480,p.context),high:p.context,step:256,probe:value=>probe(applyCandidate(base,{residentContext:value}),'KV residency boundary'),acceptable:r=>r.ok&&r.freePercent>=policy.reserveLow});if(boundary.best){p=applyCandidate(base,{residentContext:boundary.best.value});best=boundary.best.result;}
 }
 const decodeKnobs=[['--spec',[1,2,4,6,8]],['--pool-workers',[1,2,4,8,16]],['--short-read',[0,16,32,64,128]],['--batch',[2,4,8]]];
 for(const[flag,values]of decodeKnobs){if(locked(p,'options.'+flag)||flag==='--spec'&&!p.mtpPath)continue;let knobBest={profile:p,result:best};for(const value of values){const candidate=applyCandidate(p,{['options.'+flag]:value});const result=await probe(candidate,`Decode ${flag}=${value}`);if(result.ok&&result.freePercent>=policy.reserveLow&&result.decode>knobBest.result.decode)knobBest={profile:candidate,result};}p=knobBest.profile;best=knobBest.result;}
 const decodePeak=best.decode;
 let prefillBest=await probe(p,'Prefill baseline',{prefill:true});if(!prefillBest.ok)throw new Error(prefillBest.error);
 for(const flag of ['--prefill','--short-read','--pool-tasks']){if(locked(p,'options.'+flag))continue;const values=flag==='--prefill'?[256,512,1024,2048,4096,8192]:flag==='--short-read'?[0,32,64,128]:[0,64,128,256];for(const value of values){const candidate=applyCandidate(p,{['options.'+flag]:value});const long=await probe(candidate,`Prefill ${flag}=${value}`,{prefill:true});if(!long.ok||long.freePercent<policy.reserveLow||long.prefill<=prefillBest.prefill)continue;const short=await probe(candidate,'Decode regression check');if(short.ok&&short.decode>=decodePeak*(1-policy.maxDecodeLoss/100)){p=candidate;best=short;prefillBest=long;}}}
 if(!locked(p,'options.--expert-cache')){
  const boundary=await binaryBoundary({low:0,high:p.expertCount||policy.maxExperts,step:1,probe:value=>probe(applyCandidate(p,{'options.--expert-cache':value}),'Expert residency boundary'),acceptable:r=>r.ok&&r.freePercent>=policy.finalReserveLow&&r.decode>=decodePeak*(1-policy.maxDecodeLoss/100)});
  if(boundary.best){p=applyCandidate(p,{'options.--expert-cache':boundary.best.value});best=boundary.best.result;}
 }
 report('Validate at the requested full context');
 const final=await probe(p,'Full-context validation',{full:true,prefill:true});
 const finalShort=final.ok?await probe(p,'Final short decode'):null;
 if(!final.ok||!finalShort?.ok||finalShort.decode<decodePeak*(1-policy.maxDecodeLoss/100)||final.freePercent<policy.finalReserveLow)throw new Error('Final context, decode, or memory validation failed. The prior saved tune is unchanged.');
 return{version:1,timestamp:new Date().toISOString(),hardware:gpu,policy,tuned:p.tuned,decodePeak,final,finalShort,trials,locks:[...original.locks],reserveTargetMet:final.freePercent<=policy.finalReserveHigh,note:final.freePercent>policy.finalReserveHigh?'The next measured allocation did not fit; retained the larger free-memory margin.':'Measured within the requested reserve.'};
}
