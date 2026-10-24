import {reasoningIsOff} from './reasoning.js';
export function samplingFor(p,body={}){
 const presets=p.samplingPresets;
 const vision=body.messages?.some(m=>Array.isArray(m.content)&&m.content.some(c=>['image_url','input_image'].includes(c.type)));
 return presets?(reasoningIsOff(p)?vision&&presets.instructVision||presets.instruct:vision&&presets.thinkingVision||presets.thinking)??presets.default:undefined;
}
export function applySampling(body,p){
 const sampling=samplingFor(p,body);if(!sampling)return;
 for(const key of ['temperature','top_p','top_k','min_p','presence_penalty','frequency_penalty'])if(sampling[key]!=null)body[key]=sampling[key];
 if(sampling.repetition_penalty!=null)body.repeat_penalty=sampling.repetition_penalty;
 if(p.nativeServer==='llama')body.chat_template_kwargs={...body.chat_template_kwargs,enable_thinking:!reasoningIsOff(p)};
}
export function nativeServerArgs(p){
 if(p.nativeServer!=='llama')throw Error('Unsupported native server backend.');
 const pair={FP16:'f16',Q8:'q8_0'};
 if(!pair[p.kvK]||!pair[p.kvV])throw Error('Native model profiles require FP16 or Q8 KV.');
 const args=['--model',p.modelPath,'--host','127.0.0.1','--port',String(p.port),'--alias',p.modelId||p.id,'--ctx-size',String(p.context),'--cache-type-k',pair[p.kvK],'--cache-type-v',pair[p.kvV],'--parallel','1','--flash-attn','on','--jinja','--no-context-shift'];
 if(p.projectorPath&&p.visionDevice!=='off')args.push('--mmproj',p.projectorPath);
 for(const[flag,value]of Object.entries(p.options||{})){
  if(value===false||value==null||value==='')continue;
  if(!/^--[a-z][a-z0-9-]*$/.test(flag))throw Error('Invalid native option.');
  if(Array.isArray(value))for(const v of value)args.push(flag,String(v));
  else args.push(flag,...(value===true?[]:[String(value)]));
 }
 return [...args,...p.extraArgs];
}
