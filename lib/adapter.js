import { profileReasoning, reasoningModelFields, withReasoningInfo, selectedReasoningProfile } from './reasoning.js';
import { LlmAdapter, LlmError, resolveRetryPolicy, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm';
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { createProvider } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
export const wireId=p=>String(p.modelId || p.options?.['--model-id'] || p.id);
export class LocalAdapter extends LlmAdapter {
 constructor(ctx,runtime,title){super();this.ctx=ctx;this.runtime=runtime;this.title=title;}
 providerInfo(provider){return{id:provider,name:this.title};}
 profile(model){const p=this.runtime.profiles.find(x=>wireId(x)===model&&x.enabled!==false);if(!p)throw new LlmError('Saved model profile not found.','UNKNOWN_MODEL');return structuredClone(p);}
 delegate(provider,p){
  const vision=this.runtime.engine==='strata'?!!p.projectorPath&&p.visionDevice!=='off':!!(p.options['--vision']||p.options['--vision-cpu']);
  const model={id:wireId(p),name:p.name,api:'openai-completions',provider,baseUrl:`http://127.0.0.1:${p.port}/v1`,...reasoningModelFields(p),input:vision?['text','image']:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:p.context,maxTokens:Math.min(p.context,p.maxTokens||32768),compat:{supportsReasoningEffort:true,supportsDeveloperRole:false,supportsStore:false}};
  const piProvider=createProvider({id:provider,name:this.title,baseUrl:model.baseUrl,auth:{apiKey:{name:this.title,resolve:async()=>({auth:{}})}},models:[model],api:openAICompletionsApi()});
  const resolved={provider,displayName:this.title,piProvider,modelErrors:new Map(),configuredMaxTokens:new Map(),streamIdleTimeoutMs:900000,...(profileReasoning(p).defaultEffort?{reasoning:'medium'}:{}),maxRequestImageBytes:20*1024*1024,requestImagePixelBudget:4*1024*1024,requestImageMaxBytes:1024*1024,retryPolicy:resolveRetryPolicy(),headers:{}};
  const profiles=new Map([[provider,resolved]]);
  return new PiAiAdapter({profiles:()=>profiles,resolveApiKey:async()=>p.options?.['--api-key']||p.serverConfig?.api_key||'dsh-local',auth:{credentials:{read:async()=>undefined,list:async()=>[],modify:async()=>{throw new Error('Local engine credentials are not stored.');},delete:async()=>{}},authContext:{env:async()=>undefined,fileExists:async()=>false}},resolveAttachments:()=>this.ctx.get('attachments'),resolveImageAccess:(attachments,ref)=>resolveImageAttachmentAccess(attachments,path=>this.ctx.get('fs')?.processPathFromHostPath(path),ref)});
 }
 async listModels(provider){return this.runtime.profiles.filter(p=>p.enabled!==false).map(p=>({provider,id:wireId(p),name:p.name,inputModalities:this.runtime.engine==='strata'&&p.projectorPath&&p.visionDevice!=='off'?['text','image']:['text']}));}
 async resolveModel(provider,model,signal){const p=this.profile(model);return withReasoningInfo(await this.delegate(provider,p).resolveModel(provider,model,signal),p);}
 async prepareCall(provider,model,signal){
  const p=this.profile(model),adapter=this,runtime=this.runtime;
  const info=await this.resolveModel(provider,model,signal);
  return {model:info,async *stream(options){
   let selected;
   try{selected=selectedReasoningProfile(p,options.reasoningEffort);}catch(error){throw new LlmError(error.message,'UNSUPPORTED_REASONING_EFFORT');}
   const delegate=adapter.delegate(provider,selected);
   const prepared=await delegate.prepareCall(provider,model,options.signal);
   // Serialize restore, generation and checkpoint publication: Strata exposes one native slot.
   const lease=await runtime.acquire(p,options.signal);
   let release,state;
   try{
    release=await runtime.cache.gate.acquire(lease.signal);
    state=lease.state;
    state.active=(state.active||0)+1;
    const caching=p.kvCache!==false&&options.sessionId&&!options.purpose&&!state.external;
    let identity,digests;
    if(caching){identity=await runtime.cache.identity(p);digests=runtime.cache.digests(options);try{await runtime.cache.restore(state,options.sessionId,identity,digests,runtime.serverHeaders(p));}catch(error){runtime.cache.warn(state,error);}}
    else {state.kvSession=null;state.kvIdentity=null;}
    state.kvSession=null;state.kvIdentity=null;
    let completed=false;
    try{for await(const chunk of prepared.stream({...options,signal:lease.signal,reasoningEffort:selected.reasoning.efforts.length?'medium':undefined})){if(chunk.type==='finish')completed=['stop','tool-calls','max-tokens'].includes(chunk.reason?.kind);yield chunk;}}
    finally{
     if(caching&&completed&&state.ready){try{await runtime.cache.save(state,options.sessionId,identity,digests,runtime.serverHeaders(p));}catch(error){runtime.cache.warn(state,error);}}
     runtime.onChange();
    }
   }finally{if(state)state.active=Math.max(0,(state.active||0)-1);release?.();lease.release();}
  }};
 }

 async *stream(options){const call=await this.prepareCall(options.provider,options.model,options.signal);yield*call.stream(options);}
}
