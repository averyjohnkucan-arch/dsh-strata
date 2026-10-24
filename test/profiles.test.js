import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile,optionArgs,strataArgs,ninferSeed,ninferArgs,normalizeProfile,launchFingerprint} from '../lib/profiles.js';
import {applyCandidate,binaryBoundary} from '../lib/tuner.js';
test('manual controls and engine CLI flags survive tuning candidates',()=>{const p=freshProfile('strata');p.kvK='Q8';p.options['--prefill']=512;p.locks=['kvK','options.--prefill'];const next=applyCandidate(p,{kvK:'FP16',kvV:'Q5','options.--prefill':8192,'options.--expert-cache':1200});assert.equal(next.kvK,'Q8');assert.equal(next.tuned.kvK,undefined);assert.equal(next.tuned.kvV,'Q5');assert.equal(next.tuned.options['--prefill'],undefined);assert.ok(strataArgs(next).includes('Q8/Q5'));assert.equal(strataArgs(next)[strataArgs(next).indexOf('--prefill')+1],'512');});
test('80 percent resident KV and explicit token residency form correct arguments',()=>{const p=freshProfile('strata');const args=strataArgs(p);assert.equal(args[args.indexOf('--kv-resident')+1],'209715');p.residentMode='context';p.residentContext=262144;assert.equal(strataArgs(p)[strataArgs(p).indexOf('--kv-resident')+1],'0');});
test('NInfer reference launch options reproduce the supplied configuration',()=>{const p=ninferSeed(),args=ninferArgs(p);for(const flag of ['--lm-head-draft','--embedding-q4','--gdn-state-fp16','--prefill-cublas'])assert.ok(args.includes(flag));for(const [flag,value] of [['--kv-dtype','rk4v4'],['--spec','dflash2'],['--draft-tokens','7'],['--prefill-chunk','512'],['--max-context','262144'],['--ngram-draft-tokens','0']])assert.equal(args[args.indexOf(flag)+1],value);assert.ok(!args.includes('--vision'));});
test('CLI overrides normalize into locked high-level controls',()=>{const p=freshProfile('strata');p.options={'--kv':'Q8/Q5','--kv-resident':0,'--max-context':'65536'};const n=normalizeProfile(p,'strata');assert.equal(n.context,65536);assert.equal(n.residentContext,65536);assert.equal(n.kvK,'Q8');assert.ok(n.locks.includes('kvV'));assert.equal(n.options['--kv'],undefined);});
test('unsupported K/V selections fail before launch',()=>{const p=freshProfile('strata');p.kvK='Q4';p.kvV='FP16';assert.throws(()=>normalizeProfile(p,'strata'),/Unsupported/);});
test('imported argument vectors retain exact ordering until an inference control changes',()=>{const p=freshProfile('strata');p.importedEngineArgs=['--prefill','512','--kv','fp16'];p.importedFingerprint=launchFingerprint(p);assert.deepEqual(strataArgs(p),p.importedEngineArgs);p.context=8192;assert.notDeepEqual(strataArgs(p),p.importedEngineArgs);});
test('binary memory boundary returns the largest acceptable allocation and checks neighbors',async()=>{const result=await binaryBoundary({low:0,high:100,probe:async n=>({ok:n<=71}),acceptable:r=>r.ok});assert.equal(result.best.value,71);assert.ok(result.visited.some(([n])=>n===72));});
test('argv values have no shell expansion and tuple parameters remain adjacent',()=>{assert.deepEqual(optionArgs({'--path':'$(touch /tmp/nope)','--control-vector-layer-range':{argv:[1,48]},'--native-dense-gguf':['a','b']}),['--path','$(touch /tmp/nope)','--control-vector-layer-range','1','48','--native-dense-gguf','a','--native-dense-gguf','b']);});
test('staged tuner preserves locks and rejects prefill gains that lose over 5 percent decode',async()=>{const {tune}=await import('../lib/tuner.js');const p=freshProfile('strata');p.kvK='Q8';p.kvV='Q5';p.expertCount=1024;p.tunePolicy.maxTrials=80;p.options['--pool-workers']=3;p.locks=['kvK','kvV','context','residentMode','residentPercent','visionDevice','options.--spec','options.--pool-workers','options.--short-read','options.--batch','options.--pool-tasks'];const candidates=[];const result=await tune(p,{running:new Map()},new AbortController().signal,()=>{},{gpuReader:async()=>({totalMiB:24576,freePercent:99,utilization:0}),evaluator:async c=>{candidates.push(c);assert.equal(c.kvK,'Q8');assert.equal(c.kvV,'Q5');assert.equal(c.options['--pool-workers'],3);const prefill=c.tuned.options['--prefill']||512,experts=c.tuned.options['--expert-cache']||0;return{ok:true,decode:prefill===1024?90:prefill===8192?96:100,prefill:prefill===1024?9999:prefill,freePercent:10-experts/100};}});assert.equal(result.tuned.options['--prefill'],8192);assert.notEqual(result.tuned.options['--prefill'],1024);assert.ok(result.final.freePercent>=0.7&&result.final.freePercent<=1.5);assert.equal(result.decodePeak,100);assert.ok(result.finalShort.decode>=95);assert.ok(candidates.length>10);});

test('Qwen35 native options preserve numeric embedded MTP and map exact KV modes',()=>{
 const p={...freshProfile('strata'),architecture:'qwen35moe',modelPath:'/models/q36.gguf',kvCache:false,residentPercent:100,options:{'--mtp':2}};
 for(const [type,flag] of [['FP16','fp16'],['Q8','int8']]){
  p.kvK=p.kvV=type;const clean=normalizeProfile(p,'strata');assert.equal(clean.options['--mtp'],2);assert.equal(clean.mtpPath,'');
  const args=strataArgs(clean);assert.equal(args[args.indexOf('--kv')+1],flag);assert.equal(args[args.indexOf('--mtp')+1],'2');assert.ok(!args.includes('--pack'));assert.ok(!args.includes('--kv-resident'));
 }
 p.kvK='FP16';assert.throws(()=>strataArgs(p),/supports FP16/);
});
test('Qwen35 rejects invented residency and checkpoint capabilities',()=>{
 const p={...freshProfile('strata'),architecture:'qwen35moe',kvCache:false,residentPercent:80};assert.throws(()=>strataArgs(p),/partial token-cell/);
 p.residentPercent=100;p.kvCache=true;assert.throws(()=>strataArgs(p),/checkpoint/);
 p.kvCache=false;p.options['--spec']=2;assert.throws(()=>strataArgs(p),/does not use --spec/);
});

test('external Qwen MTP is explicit, numeric and fingerprinted without replacing target weights',()=>{
 const p={...freshProfile('strata'),architecture:'qwen35moe',modelPath:'/target.gguf',externalMtpPath:'/donor.gguf',embeddedMtp:false,kvCache:false,residentPercent:100,options:{'--mtp':2}};
 const a=strataArgs(p);assert.equal(a[a.indexOf('--native')+1],'/target.gguf');assert.equal(a[a.indexOf('--mtp-model')+1],'/donor.gguf');
 const old=launchFingerprint(p);p.externalMtpPath='/other.gguf';assert.notEqual(launchFingerprint(p),old);
 p.embeddedMtp=true;assert.throws(()=>strataArgs(p),/cannot replace/);p.embeddedMtp=false;p.options['--mtp']=0;assert.throws(()=>strataArgs(p),/positive MTP/);
});
