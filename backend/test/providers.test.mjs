import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {OpenAICompatibleProvider} from '../src/providers.mjs';
async function upstream(t,handler) {
 const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;await handler(req,res,body);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 return `http://127.0.0.1:${server.address().port}/v1`;
}
const frame=data=>`data: ${JSON.stringify(data)}\r\n\r\n`;
const reply=(res,delta)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(frame({choices:[{delta}]})+'data: [DONE]\r\n\r\n');};
const config={model:'approved',systemPrompt:'System',tools:[],engine:'tts'};
test('real fetch adapter preserves vision, model, prompt and parses fragmented streaming SSE',async t=>{
 let received;
 const base=await upstream(t,async(req,res,body)=>{received=JSON.parse(body);assert.equal(req.headers.authorization,'Bearer test-only');res.writeHead(200,{'content-type':'text/event-stream'});const data=frame({choices:[{delta:{content:'Hello 🌍'}}]});const bytes=Buffer.from(data);res.write(bytes.subarray(0,20));res.end(Buffer.concat([bytes.subarray(20),Buffer.from('data: [DONE]\r\n\r\n')]));});
 const provider=new OpenAICompatibleProvider({baseUrl:base,apiKey:'test-only'});const messages=[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,YQ=='}}]}],events=[];
 assert.equal(await provider.respond({config,messages,signal:new AbortController().signal,emit:e=>events.push(e)}),'Hello 🌍');
 assert.equal(received.model,'approved');assert.equal(received.messages[0].content,'System');assert.deepEqual(received.messages[1],messages[0]);assert.equal(events[0].text,'Hello 🌍');
});
test('model tool calls invoke only configured MCP endpoint and include tool output in next request',async t=>{
 let count=0,mcpCalls=0;
 const base=await upstream(t,async(req,res,body)=>{
  const data=JSON.parse(body);
  if(req.url==='/v1/mcp'){mcpCalls++;assert.equal(data.method,'tools/call');assert.equal(data.params.name,'Project.Read');res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:data.id,result:{content:[{type:'text',text:'Project found'}]}}));return;}
  count++;
  if(count===1)reply(res,{tool_calls:[{index:0,id:'call1',function:{name:'project_read',arguments:'{"id":"one"}'}}]});
  else {assert.equal(data.messages.at(-1).role,'tool');assert.match(data.messages.at(-1).content,/Project found/);reply(res,{content:'Done'});}
 });
 const provider=new OpenAICompatibleProvider({baseUrl:base,apiKey:'test-only'});
 const result=await provider.respond({config:{...config,tools:[{name:'project_read',remoteName:'Project.Read',stateless:true,endpoint:`${base}/mcp`}]},messages:[{role:'user',content:'Read project'}],signal:new AbortController().signal,emit:()=>{}});
 assert.equal(result,'Done');assert.equal(mcpCalls,1);
});
test('provider rejects model-invented tool before invocation',async t=>{
 const base=await upstream(t,async(req,res)=>reply(res,{tool_calls:[{index:0,id:'bad',function:{name:'shell',arguments:'{}'}}]}));
 const provider=new OpenAICompatibleProvider({baseUrl:base,apiKey:'test-only'});
 await assert.rejects(provider.respond({config,messages:[],signal:new AbortController().signal,emit:()=>{}}),{code:'tool_forbidden'});
});
test('OpenAI STT/realtime and ElevenLabs PCM requests use actual HTTP contract',async t=>{
 const seen=[];
 const base=await upstream(t,async(req,res,body)=>{
  seen.push({path:req.url,body,headers:req.headers});
  if(req.url.includes('/transcriptions')){res.setHeader('content-type','application/json');res.end('{"text":"Recorded words"}');}
  else if(req.url.includes('client_secrets')){res.setHeader('content-type','application/json');res.end('{"value":"ephemeral-test-only","expires_at":12345}');}
  else {res.writeHead(200,{'content-type':'application/octet-stream'});res.write(Buffer.from([1,2,3]));res.end(Buffer.from([4,5,6]));}
 });
 const provider=new OpenAICompatibleProvider({baseUrl:base,apiKey:'test-only',openAIBaseUrl:base,openAIKey:'openai-test-only',elevenLabsBaseUrl:base,elevenLabsKey:'eleven-test-only',elevenLabsVoice:'test-voice'});
 const signal=new AbortController().signal;
 assert.equal(await provider.transcribe(Buffer.from('audio'),'audio/webm',{signal}),'Recorded words');
 const token=await provider.mintRealtime({...config,model:'gpt-realtime-mini'});assert.equal(token.token,'ephemeral-test-only');
 const mint=JSON.parse(seen[1].body);assert.equal(mint.session.audio.input.turn_detection.interrupt_response,true);assert.equal(mint.session.instructions,'System');
 const chunks=[];await provider.speak('Hi',{config:{...config,engine:'elevenlabs'},signal,emit:e=>chunks.push(e)});
 assert.deepEqual(Buffer.concat(chunks.map(c=>Buffer.from(c.data,'base64'))),Buffer.from([1,2,3,4,5,6]));
 assert.ok(chunks.every(c=>Buffer.from(c.data,'base64').length%2===0));assert.equal(chunks[0].sampleRate,24000);
 assert.equal(seen[2].headers['xi-api-key'],'eleven-test-only');assert.match(seen[2].path,/output_format=pcm_24000/);
 assert.match(seen[0].headers['content-type'],/multipart\/form-data/);
});
test('aborted provider fetch rejects and emits no synthesized media',async t=>{
 const controller=new AbortController();controller.abort();
 const provider=new OpenAICompatibleProvider({apiKey:'test-only'});let emitted=false;
 await assert.rejects(provider.speak('hello',{config,signal:controller.signal,emit:()=>emitted=true}));assert.equal(emitted,false);
});

test('MCP client initializes, lists allowlisted tool definitions and calls with negotiated session headers',async t=>{
 const {MCPClient}=await import('../src/mcp.mjs');const methods=[];
 const base=await upstream(t,async(req,res,body)=>{
   if(req.method==='DELETE'){res.writeHead(204);res.end();return;}
   const packet=JSON.parse(body);methods.push(packet.method);
   if(packet.method==='initialize') {res.setHeader('MCP-Session-Id','session-test');res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:packet.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}}}}));return;}
   assert.equal(req.headers['mcp-session-id'],'session-test');assert.equal(req.headers['mcp-protocol-version'],'2025-11-25');
   if(packet.method==='notifications/initialized'){res.writeHead(202);res.end();return;}
   res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:packet.id,result:packet.method==='tools/list'?{tools:[{name:'read',inputSchema:{type:'object'}}]}:{content:[{type:'text',text:'ok'}]}}));
 });
 const mcp=new MCPClient({endpoint:`${base}/mcp`});const tools=await mcp.listTools();assert.equal(tools[0].name,'read');
 assert.equal((await mcp.callTool('read',{})).content[0].text,'ok');await mcp.close();
 assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','tools/call']);
});

test('dotted MCP names get provider-compatible aliases without expanding access',async t=>{
 const {functionName}=await import('../src/providers.mjs');let count=0,invoked=0;
 const base=await upstream(t,async(req,res,body)=>{const data=JSON.parse(body);assert.equal(data.tools[0].function.name,functionName('Project.Read'));if(count++===0)reply(res,{tool_calls:[{index:0,id:'a',function:{name:functionName('Project.Read'),arguments:'{}'}}]});else reply(res,{content:'Found'});});
 const provider=new OpenAICompatibleProvider({baseUrl:base,apiKey:'test-only'});
 assert.equal(await provider.respond({config:{...config,tools:[{name:'Project.Read',invoke:()=>{invoked++;return {};}}]},messages:[],signal:new AbortController().signal,emit:()=>{}}),'Found');assert.equal(invoked,1);
});
