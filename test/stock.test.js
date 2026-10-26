import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {freshProfile,strataArgs,normalizeProfile} from '../lib/profiles.js';
import {features,patchNames,kvPairs,extensionKey,validateLaunchArgs} from '../lib/features.js';
import {migrateStock,tuneSettings} from '../lib/stock.js';
import {tune,tuneArgs} from '../lib/tuner.js';
import {Runtime} from '../lib/runtime.js';

test('stock formats map to real CLI values; every extension is independently gated',()=>{
 const p=freshProfile('strata');p.kvCache=false;
 for(const pair of kvPairs(p)){[p.kvK,p.kvV]=pair.split('/');const args=strataArgs(p);assert.equal(args[args.indexOf('--kv')+1],{'FP16/FP16':'fp16','Q8/Q8':'int8','Q8/Q4':'k8v4','Q4/Q4':'q4_0'}[pair]);}
 p.kvK=p.kvV='Q6';assert.throws(()=>strataArgs(p),/Enable/);
 p.extensions={kvQ6:true};assert.ok(strataArgs(p).includes('Q6/Q6'));p.kvK='Q8';p.kvV='Q5';assert.throws(()=>strataArgs(p),/Enable/);
 p.extensions={kvQ5:true};assert.ok(strataArgs(p).includes('Q8/Q5'));p.options['--conversation-cache-mib']=1024;assert.throws(()=>strataArgs(p),/parked/);
 assert.deepEqual(patchNames({kvQ6:true,kvQ5:true}),['flash-kv-formats.patch']);assert.throws(()=>features({invented:true}),/Unknown/);
});
test('Qwen native precision is honestly FP32; INT8 and donors require their own features',()=>{
 const p={...freshProfile('strata'),architecture:'qwen35moe',kvK:'FP32',kvV:'FP32',kvCache:false,residentPercent:100,modelPath:'/target.gguf',options:{'--mtp':2}};
 assert.ok(!strataArgs(p).includes('--kv'));p.kvK=p.kvV='Q8';assert.throws(()=>strataArgs(p),/Unsupported/);
 p.extensions={qwenInt8Kv:true};assert.ok(strataArgs(p).includes('int8'));
 p.externalMtpPath='/donor.gguf';assert.throws(()=>strataArgs(p),/Enable/);p.extensions.externalMtp=true;
 const args=strataArgs(p);assert.equal(args[args.indexOf('--native')+1],'/target.gguf');assert.equal(args[args.indexOf('--mtp-model')+1],'/donor.gguf');
 p.embeddedMtp=true;assert.throws(()=>strataArgs(p),/without embedded/);p.embeddedMtp=false;p.options['--mtp']=0;assert.throws(()=>strataArgs(p),/positive/);
 p.extraArgs=['--kv=int8'];assert.throws(()=>strataArgs(p),/named profile/);
});
test('migration retains legacy settings and models, leaves independent native servers alone',()=>{
 const old={...freshProfile('strata'),engineFlavor:undefined,architecture:'qwen35moe',kvK:'Q8',kvV:'Q8',kvCache:false,modelPath:'/keep/model',options:{'--snapshots':0,'--mtp':2,'--gqa-attn':true},externalMtpPath:'/donor'};
 const p=migrateStock(old);assert.equal(p.kvK,'FP32');assert.equal(p.modelPath,old.modelPath);assert.equal(p.options['--snapshots'],undefined);assert.equal(p.options['--mtp'],0);assert.equal(p.legacyEngine.externalMtpPath,'/donor');assert.equal(old.kvK,'Q8');assert.deepEqual(migrateStock(p),p);
 const native={...old,nativeServer:'llama'};assert.equal(migrateStock(native),native);
});
test('persistent migration backs up the previous registry before replacing it',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'strata-migrate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const p={...freshProfile('strata'),engineFlavor:undefined};const before=JSON.stringify({version:2,profiles:[p]});await writeFile(join(dir,'profiles.json'),before);
 const runtime=new Runtime('strata',{dataDir:dir});await runtime.init();const names=await readdir(dir),backup=names.find(n=>n.startsWith('profiles-before-stock-'));assert.ok(backup);assert.deepEqual(JSON.parse(await readFile(join(dir,backup),'utf8')),JSON.parse(before));assert.equal(runtime.profiles[0].needsStockRuntime,true);await runtime.dispose();
});
test('stock tuning uses official flags, saves a real preset and releases scheduler admission',async t=>{
 const root=await mkdtemp(join(tmpdir(),'strata-tune-'));t.after(()=>rm(root,{recursive:true,force:true}));const p=freshProfile('strata');p.autoTune={mode:'thorough',goal:'speed',use:'coding',leaveRam:5};
 const args=tuneArgs(p,'config','/stock','status','work');assert.ok(args.includes('auto'));assert.equal(args[args.indexOf('--mode')+1],'thorough');assert.equal(args[args.indexOf('--goal')+1],'speed');assert.throws(()=>tuneSettings({leaveRam:51}),/RAM/);
 let released=false,unloaded=false;const runtime={root,running:new Map(),source:async()=>'/stock',runConfig:async()=>({cfg:{args:[]}}),scheduler:{acquire:async()=>({release(){released=true;}}),unload:async()=>{unloaded=true;}}};
 const result=await tune(p,runtime,new AbortController().signal,()=>{},{readGpu:async()=>({utilization:0,freePercent:99}),execute:async(_cmd,argv,options)=>{assert.ok(options.env.STRATA_PRESET_DIR.startsWith(root));return{stdout:JSON.stringify({schema_version:1,ok:true,result:{outcome:'improved',preset:{id:'fixture'}}})};}});
 assert.equal(result.preset.id,'fixture');assert.ok(released&&unloaded);
 await assert.rejects(()=>tune(p,runtime,new AbortController().signal,()=>{},{readGpu:async()=>({utilization:0,freePercent:99}),execute:async()=>({stdout:JSON.stringify({schema_version:1,ok:true,result:{outcome:'improved',preset:null}})})}),/did not save/);
});
test('feature identities change with patch sets and disabled flags do not create a build',async()=>{
 assert.deepEqual(patchNames(features()),[]);assert.equal(await extensionKey({kvQ6:true}),await extensionKey({kvQ5:true}));assert.notEqual(await extensionKey({kvQ6:true}),await extensionKey({qwenInt8Kv:true}));
});

test('final preset and advanced argv cannot bypass feature or residency gates',()=>{
 const p={...freshProfile('strata'),extensions:{kvQ6:true},kvCache:false,kvK:'Q6',kvV:'Q6'};
 assert.throws(()=>validateLaunchArgs(p,['--kv','Q6/Q6','--kv-grow']),/elastic/);
 assert.throws(()=>validateLaunchArgs(p,['--kv','Q6/Q6'],{STRATA_KV_GROW:'1'}),/elastic/);
 assert.throws(()=>validateLaunchArgs({...p,extensions:{}},['--kv','Q6/Q6']),/Unsupported/);
 const q={...p,architecture:'qwen35moe',kvK:'FP32',kvV:'FP32'};
 assert.throws(()=>validateLaunchArgs(q,['--kv','int8']),/does not support/);
 assert.throws(()=>validateLaunchArgs(q,['--expert-cache','auto']),/does not support/);
});
test('run configuration invokes the preset resolver and includes effective settings in cache identity',async t=>{
 const root=await mkdtemp(join(tmpdir(),'strata-config-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source');await mkdir(join(source,'serve'),{recursive:true});await mkdir(join(source,'strata_control'));await writeFile(join(source,'serve/server.py'),'');
 await writeFile(join(source,'strata_control/presets.py'),"def overlay(cfg, use='chat'):\n cfg['args'] += ['--prefill', '512']\n return cfg, {'applied': True, 'use': use}\n");
 const p={...freshProfile('strata'),sourceDir:source,executable:'/fixture/strata',modelPath:'/fixture/model',packPath:'/fixture/pack',kvCache:false,autoTune:{goal:'room',use:'coding'}};
 const runtime=new Runtime('strata',{dataDir:root});await runtime.init();
 const out=await runtime.runConfig(p);assert.equal(out.cfg.ui_resource_profile,'work');assert.equal(out.preset.use,'coding');assert.ok(out.cfg.args.includes('512'));assert.deepEqual(out.cacheProfile.stockEffective.args,out.cfg.args);
 const manual=await runtime.runConfig({...p,autoTune:{enabled:false}});assert.equal(manual.preset.applied,false);assert.ok(!manual.cfg.args.includes('512'));await runtime.dispose();
});
test('new models inherit the stock runtime rather than another model extension binary',async t=>{
 const root=await mkdtemp(join(tmpdir(),'strata-new-'));t.after(()=>rm(root,{recursive:true,force:true}));const runtime=new Runtime('strata',{dataDir:root});await runtime.init();
 runtime.profiles=[{...freshProfile('strata'),engineFlavor:'stock-extensions',executable:'/patched/strata',stockRuntime:{executable:'/stock/strata',sourceDir:'/stock',python:'/stock/python'}}];
 const p=await runtime.action('new');assert.equal(p.executable,'/stock/strata');assert.deepEqual(p.extensions,{});await runtime.dispose();
});
test('disabling the plugin aborts a runtime preparation before it can publish',async t=>{
 const root=await mkdtemp(join(tmpdir(),'strata-cancel-'));t.after(()=>rm(root,{recursive:true,force:true}));const runtime=new Runtime('strata',{dataDir:root});await runtime.init();const p=freshProfile('strata');runtime.profiles=[p];
 let started;const ready=new Promise(r=>started=r);runtime.setup=async(_id,signal)=>{started();await new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true}));};
 const operation=runtime.ensureRuntime(p.id);const rejected=assert.rejects(operation,/Cancelled/);await ready;await runtime.dispose();await rejected;assert.equal(runtime.find(p.id).executable,'');
});
