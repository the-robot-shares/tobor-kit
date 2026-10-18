import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createVoiceServer} from '../src/server.mjs';
import {FixtureProvider,fixturePolicy} from './fixture.mjs';
const config={organization:'noizu-labs',project:'noizu-infra',backend:'litellm',engine:'tts',model:'fixture-model',tools:['fixture.echo'],mcpTools:[],systemPrompt:'Be brief'};
async function setup(t,provider=new FixtureProvider()) {
 const svc=createVoiceServer({provider,authorize:()=>fixturePolicy,origins:['http://allowed.test']});
 const address=await svc.listen(0);t.after(()=>svc.close());
 const base=`http://127.0.0.1:${address.port}`;
 const init=body=>fetch(`${base}/voice/sessions`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return {svc,base,init};
}
async function socket(init) {
 const reply=await (await init(config)).json();const ws=new WebSocket(reply.websocketUrl);const events=[];
 ws.on('message',data=>events.push(JSON.parse(data)));await once(ws,'open');
 return {ws,events,reply,wait:async predicate=>{for(let i=0;i<100;i++){const value=events.find(predicate);if(value)return value;await delay(10);}throw new Error(`Timed out: ${JSON.stringify(events)}`);}};
}
test('session scope and tool policy reject escalation',async t=>{
 const {init}=await setup(t);
 for(const bad of [{organization:'other'},{project:'other'},{tools:['shell.exec']},{mcpTools:['private.read']},{model:'unapproved'},{tools:[{name:'fixture.echo',endpoint:'https://evil.test'}]}])assert.ok([400,403].includes((await init({...config,...bad})).status));
 assert.equal((await init(config)).status,201);
});
test('origin, authentication and single-use socket ticket enforced',async t=>{
 const {base,init}=await setup(t);
 assert.equal((await fetch(`${base}/voice/sessions`,{method:'POST',headers:{origin:'https://evil.test'}})).status,403);
 const {ws,reply}=await socket(init);
 const second=new WebSocket(reply.websocketUrl);const [err]=await once(second,'error');assert.match(err.message,/403/);ws.close();
 const denied=createVoiceServer({provider:new FixtureProvider(),authorize:()=>null});await denied.listen(0);t.after(()=>denied.close());
 assert.equal((await fetch(`http://127.0.0.1:${denied.server.address().port}/voice/sessions`,{method:'POST',body:'{}'})).status,401);
});
test('text and screenshot produce transcript, audio and state over actual websocket',async t=>{
 const {init}=await setup(t);const {ws,events,wait}=await socket(init);
 ws.send(JSON.stringify({type:'input.text',text:'hello'}));await wait(e=>e.type==='animation'&&e.state==='idle');
 assert.ok(events.some(e=>e.type==='transcript'&&e.role==='assistant'&&e.text==='Sandbox voice reply: hello'));
 assert.ok(events.some(e=>e.type==='audio'&&e.mimeType==='audio/pcm'));
 ws.send(JSON.stringify({type:'input.screenshot',dataUrl:'data:image/png;base64,aGVsbG8=',text:'Review page'}));
 await wait(e=>e.type==='transcript'&&e.text.includes('[image received]'));
 ws.close();
});
test('interrupt aborts work and suppresses late upstream audio/text',async t=>{
 let aborted=false;
 const provider=new FixtureProvider();provider.respond=async({signal,emit})=>{signal.addEventListener('abort',()=>aborted=true);await delay(100);emit({type:'audio',data:'AAAA',mimeType:'audio/pcm'});return 'stale reply';};
 const {init}=await setup(t,provider);const {ws,events,wait}=await socket(init);
 ws.send(JSON.stringify({type:'input.text',text:'slow'}));await wait(e=>e.type==='transcript'&&e.role==='user');
 ws.send(JSON.stringify({type:'interrupt'}));await wait(e=>e.type==='interrupted');await delay(150);
 assert.equal(aborted,true);assert.ok(!events.some(e=>e.type==='audio'||e.type==='transcript'&&e.role==='assistant'));ws.close();
});
test('malformed and unsupported media do not crash a session',async t=>{
 const {init}=await setup(t);const {ws,wait}=await socket(init);
 ws.send('{');await wait(e=>e.code==='invalid_message');
 ws.send(JSON.stringify({type:'input.image',dataUrl:'https://private.internal'}));await wait(e=>e.code==='invalid_media');
 ws.send(JSON.stringify({type:'input.text',text:'still works'}));await wait(e=>e.text==='Sandbox voice reply: still works');ws.close();
});
test('realtime transcripts preserve individual turns and tool requests remain allowlisted',async t=>{
 const provider=new FixtureProvider();provider.mintRealtime=async()=>({token:'ephemeral-test'});
 let calls=0;provider.invokeTool=async()=>{calls++;return {ok:true};};
 const {init}=await setup(t,provider);
 const response=await init({...config,engine:'openai-realtime'});const data=await response.json();const ws=new WebSocket(data.websocketUrl);const events=[];ws.on('message',data=>events.push(JSON.parse(data)));await once(ws,'open');
 for(const id of ['first','second'])ws.send(JSON.stringify({type:'realtime.event',event:{type:'response.output_audio_transcript.done',item_id:id,transcript:id}}));
 ws.send(JSON.stringify({type:'realtime.event',event:{type:'response.function_call_arguments.done',name:'unapproved',arguments:'{}',call_id:'bad'}}));
 await delay(30);
 assert.deepEqual(events.filter(e=>e.type==='transcript').map(e=>e.turnId),['first','second']);assert.equal(calls,0);assert.ok(events.some(e=>e.code==='forbidden'));ws.close();
});
