import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {prefixTokenizer} from '../lib/prefix-tokenizer.js';
test('prefix rendering uses a plugin-owned tokenizer copy and preserves source and normal generation check',async t=>{
 const root=await mkdtemp(join(tmpdir(),'strata-prefix-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=join(root,'model');await mkdir(source);
 const original="{%- if ns.multi_step_tool %}{{ raise_exception('No user query found in messages.') }}{% endif %}";
 await writeFile(join(source,'chat_template.jinja'),original);await writeFile(join(root,'vocab.json'),'weights');await symlink(join(root,'vocab.json'),join(source,'tokenizer.json'));
 const target=await prefixTokenizer(source,join(root,'plugin'));assert.notEqual(target,source);assert.equal(await readFile(join(source,'chat_template.jinja'),'utf8'),original);assert.match(await readFile(join(target,'chat_template.jinja'),'utf8'),/and add_generation_prompt != false/);assert.equal(await readFile(join(target,'tokenizer.json'),'utf8'),'weights');
 await writeFile(join(source,'chat_template.jinja'),'other template');assert.equal(await prefixTokenizer(source,join(root,'plugin')),source);
});
