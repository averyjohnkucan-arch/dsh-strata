/** Mark only the shared leading system/tool instructions through Strata's public API. */
export function checkpointApi(api,{beforeRequest}={}){
 const wrap=method=>(model,context,options={})=>api[method](model,context,{
  ...options,onPayload:async(payload,target)=>{
   const selected=await options.onPayload?.(payload,target);let body=selected??payload;
   if(options.sessionId&&body.messages?.[0]?.role==='system'&&body.messages.length>1)body={...body,strata_prefix:{messages:1}};
   await beforeRequest?.(body);
   return body;
  }
 });
 return {...api,stream:wrap('stream'),streamSimple:wrap('streamSimple')};
}
