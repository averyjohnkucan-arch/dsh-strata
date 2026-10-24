import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {importConfig} from '../lib/import-config.js';import {strataArgs} from '../lib/profiles.js';
test('saved Qwen35 config retains numeric external MTP and native INT8 KV without Flash flags',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'q36-import-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'native.json');
 await writeFile(path,JSON.stringify({arch:'qwen35moe',exe:'/missing/strata',cwd:'/missing/source',args:['--native','/target.gguf','--max-context','262144','--kv','int8','--mtp','2','--mtp-model','/donor.gguf','--expert-slots','24']}));
 const p=await importConfig(path),args=strataArgs(p);
 assert.equal(p.architecture,'qwen35moe');assert.equal(p.modelPath,'/target.gguf');assert.equal(p.externalMtpPath,'/donor.gguf');assert.equal(p.mtpPath,'');assert.equal(p.kvCache,false);
 assert.equal(args[args.indexOf('--mtp')+1],'2');assert.equal(args[args.indexOf('--kv')+1],'int8');assert.ok(!args.includes('--kv-resident'));assert.ok(!args.includes('--pack'));
});
