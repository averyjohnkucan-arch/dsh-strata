import {readFile,mkdir,readdir,writeFile,stat,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
/** Qwen requires a user query even when Strata renders only a prefix. Keep the
 * generation check, but permit the native prefix renderer's non-generation pass.
 * The model directory is never modified. Unknown templates remain untouched.
 */
export async function prefixTokenizer(source,root){
 const path=join(source,'chat_template.jinja');let text;
 try{text=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')return source;throw e;}
 const needle='{%- if ns.multi_step_tool %}';
 if(!text.includes(needle)||!text.includes("raise_exception('No user query found in messages.')"))return source;
 const files=[];
 for(const entry of await readdir(source,{withFileTypes:true}))if(entry.isFile()||(entry.isSymbolicLink()&&(await stat(join(source,entry.name))).isFile()))files.push([entry.name,await readFile(join(source,entry.name))]);
 const hash=createHash('sha256').update('prefix-template-v1');for(const[name,data]of files.sort((a,b)=>a[0].localeCompare(b[0])))hash.update(name).update(data);
 const target=join(root,hash.digest('hex'));
 try{await access(join(target,'.complete'));return target;}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(target,{recursive:true,mode:0o700});
 for(const[name,data]of files){if(name==='chat_template.jinja')await writeFile(join(target,name),text.replace(needle,'{%- if ns.multi_step_tool and add_generation_prompt != false %}'));else await writeFile(join(target,name),data);}
 await writeFile(join(target,'.complete'),'1');return target;
}
