import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {importConfig} from '../lib/import-config.js';import {strataArgs} from '../lib/profiles.js';
test('saved Qwen35 config cannot silently enable missing INT8 or external MTP features',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'q36-import-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'native.json');
 await writeFile(path,JSON.stringify({arch:'qwen35moe',exe:'/missing/strata',cwd:'/missing/source',args:['--native','/target.gguf','--max-context','262144','--kv','int8','--mtp','2','--mtp-model','/donor.gguf','--expert-slots','24']}));
 await assert.rejects(()=>importConfig(path),/Unsupported KV pair|Enable.*extension/);
});
