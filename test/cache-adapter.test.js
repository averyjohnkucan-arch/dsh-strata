import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {LocalAdapter} from '../lib/adapter.js';import {freshProfile} from '../lib/profiles.js';import {SerialGate} from '../lib/kv-cache.js';
test('adapter brackets a real SSE stream with chat restore/save and skips auxiliary calls',async t=>{
 const events=[],state={ready:true,active:0};let fail=false;const bodies=[];
 const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;bodies.push(JSON.parse(body));if(fail){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'invalid fixture request'}}));return;}res.writeHead(200,{'Content-Type':'text/event-stream'});for(const choices of [[{index:0,delta:{role:'assistant',content:'Hello'},finish_reason:null}],[{index:0,delta:{},finish_reason:'stop'}]])res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices})+'\n\n');res.end('data: [DONE]\n\n');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const p=freshProfile('strata');p.id='fixture';p.port=server.address().port;
 const runtime={engine:'strata',profiles:[p],acquire:async()=>({state,release:()=>events.push('release')}),onChange:()=>{},serverHeaders:()=>({}),cache:{gate:new SerialGate(),identity:async()=> 'model',digests:options=>options.messages.map(m=>m.role),base:async()=>{events.push('base');},restore:async(_s,session)=>events.push('restore '+session),save:async(_s,session)=>events.push('save '+session),warn:()=>events.push('warning')}};
 const adapter=new LocalAdapter({get:()=>undefined},runtime,'Strata'),call=await adapter.prepareCall('strata','fixture');
 const options={provider:'strata',model:'fixture',sessionId:'chat-a',system:'Shared instructions',messages:[{role:'user',content:[{type:'text',text:'Hi'}]}]};
 for await(const chunk of call.stream(options)){}assert.deepEqual(events,['base','restore chat-a','save chat-a','release']);assert.equal(state.active,0);assert.deepEqual(bodies[0].strata_prefix,{messages:1});
 events.length=0;for await(const chunk of call.stream({...options,purpose:'session-title'})){}assert.deepEqual(events,['release']);
 events.length=0;fail=true;try{for await(const chunk of call.stream(options)){}}catch{}assert.deepEqual(events,['base','restore chat-a','release']);assert.equal(state.active,0);
});
