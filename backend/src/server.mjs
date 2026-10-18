import http from 'node:http';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX = 8 * 1024 * 1024;
const states = new Set(['idle','listening','thinking','speaking','tool_running','error','offline']);
const fail = (code, message) => Object.assign(new Error(message), {code});
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const strings = value => Array.isArray(value) && value.length <= 100 && value.every(x => typeof x === 'string' && x.length < 256);

/** Policy returns the authenticated caller's exact permitted scope. Never trust browser tool definitions. */
export function authorizeConfig(requested, policy) {
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) throw fail('invalid_config','Expected session configuration');
  for (const field of ['organization','project','engine','backend','model']) {
    if (typeof requested[field] !== 'string' || !requested[field] || requested[field].length > 256) throw fail('invalid_config',`${field} is required`);
    if (!policy[`${field}s`]?.includes(requested[field])) throw fail('forbidden',`${field} is not allowed`);
  }
  if (!strings(requested.tools ?? []) || !strings(requested.mcpTools ?? [])) throw fail('invalid_config','Tools must be arrays of names');
  const selected = [...new Set([...(requested.tools ?? []), ...(requested.mcpTools ?? [])])];
  for (const name of selected) if (!policy.tools?.[name]) throw fail('forbidden',`Tool ${name} is not allowed`);
  const prompt = requested.systemPrompt ?? policy.systemPrompt ?? '';
  if (typeof prompt !== 'string' || prompt.length > 32000) throw fail('invalid_config','Invalid system prompt');
  if (!policy.allowSystemPrompt && prompt !== (policy.systemPrompt ?? '')) throw fail('forbidden','System prompt override is disabled');
  for (const key of ['voice','ttsModel']) if (requested[key] !== undefined && (typeof requested[key] !== 'string' || requested[key].length > 128)) throw fail('invalid_config',`Invalid ${key}`);
  return {...Object.fromEntries(['organization','project','engine','backend','model','voice','ttsModel'].map(k => [k,requested[k]])),systemPrompt:prompt,tools:selected.map(name => ({...policy.tools[name],name})),mcpTools:requested.mcpTools ?? []};
}

export function createVoiceServer({ provider, authorize, origins = [], publicUrl, sessionTtlMs = 30 * 60_000, maxSessions = 100, maxPayload = MAX } = {}) {
  if (!provider || typeof authorize !== 'function') throw new Error('provider and authorize are required');
  const sessions = new Map();
  const sockets = new WebSocketServer({noServer:true,maxPayload});
  const originAllowed = req => !req.headers.origin || origins.includes(req.headers.origin);
  const json = (res,status,value) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const server = http.createServer(async(req,res) => {
    if (!originAllowed(req)) return json(res,403,{code:'origin_denied',message:'Origin denied'});
    if (req.headers.origin) {res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Credentials','true');}
    if (req.method === 'OPTIONS') {res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.writeHead(204);return res.end();}
    if (req.method === 'GET' && req.url === '/health') return json(res,200,{ok:true});
    if (req.method !== 'POST' || req.url !== '/voice/sessions') return json(res,404,{code:'not_found',message:'Not found'});
    try {
      let body = '';for await (const chunk of req) {body += chunk;if (Buffer.byteLength(body)>65536) throw fail('invalid_config','Configuration is too large');}
      const requested=JSON.parse(body);
      const policy=await authorize(req,requested);
      if(!policy)throw fail('unauthorized','Authentication required');
      const config=authorizeConfig(requested,policy);
      if (sessions.size >= maxSessions) return json(res,429,{code:'capacity',message:'Too many voice sessions'});
      const realtime = config.engine === 'openai-realtime' ? await provider.mintRealtime(config) : undefined;
      const sessionId = randomUUID(), ticket = randomBytes(32).toString('base64url');
      const item = {sessionId,ticket,config,expires:Date.now()+sessionTtlMs,history:[],generation:0,abort:null,ws:null};
      sessions.set(sessionId,item);
      const base = new URL(publicUrl || `http://127.0.0.1:${server.address().port}`);
      base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';base.pathname = `/voice/sessions/${sessionId}/socket`;base.searchParams.set('ticket',ticket);
      json(res,201,{sessionId,websocketUrl:base.href,realtime,expiresAt:new Date(item.expires).toISOString()});
    } catch(error) {json(res,error.code === 'unauthorized'?401:error.code === 'forbidden'?403:400,{code:error.code ?? 'invalid_request',message:error.code?error.message:'Invalid session request'});}
  });
  server.on('upgrade',(req,socket,head) => {
    const url = new URL(req.url,'http://localhost');
    const match = /^\/voice\/sessions\/([^/]+)\/socket$/.exec(url.pathname);
    const item = match && sessions.get(match[1]);
    if (!originAllowed(req) || !item || item.expires<Date.now() || item.ws || !equal(url.searchParams.get('ticket'),item.ticket)) {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    item.ticket = null; // Single-use capability, never a provider credential.
    sockets.handleUpgrade(req,socket,head,ws => attach(ws,item));
  });
  function attach(ws,item) {
    item.ws = ws;
    const send = data => {if(ws.readyState === 1) ws.send(JSON.stringify(data));};
    const cancel = () => {const turnId=item.turnId;item.generation++;item.abort?.abort();item.abort=null;send({type:'interrupted',turnId});send({type:'animation',state:'listening'});};
    send({type:'ready',sessionId:item.sessionId});
    ws.on('message',(raw,binary) => {
      let message;
      try {if(binary) throw fail('invalid_message','Use JSON messages');message=JSON.parse(raw.toString());if(!message || typeof message.type !== 'string') throw fail('invalid_message','type is required');}
      catch {send({type:'error',code:'invalid_message',message:'Expected a JSON event with a type'});return;}
      if(message.type==='interrupt') {cancel();return;}
      if(message.type==='animation') {if(states.has(message.state))send({type:'animation',state:message.state});return;}
      if(message.type==='realtime.event') {void realtimeEvent(message.event).catch(error => send({type:'error',code:error.code??'provider_error',message:'Realtime event failed'}));return;}
      void turn(message).catch(error => send({type:'error',code:error.code??'invalid_message',message:error.code?error.message:'Voice turn failed'}));
    });
    ws.on('close',()=>{item.abort?.abort();sessions.delete(item.sessionId);});
    ws.on('error',()=>item.abort?.abort());
    async function realtimeEvent(event) {
      if(item.config.engine!=='openai-realtime' || !event || typeof event.type!=='string') throw fail('invalid_message','Invalid realtime event');
      if(event.type==='input_audio_buffer.speech_started') cancel();
      if(event.type==='conversation.item.input_audio_transcription.completed') send({type:'transcript',role:'user',text:String(event.transcript??''),final:true,turnId:event.item_id??randomUUID()});
      if(['response.output_audio_transcript.done','response.audio_transcript.done'].includes(event.type))send({type:'transcript',role:'assistant',text:String(event.transcript??''),final:true,turnId:event.item_id??event.response_id??randomUUID()});
      if(event.type==='response.function_call_arguments.done') {
        const tool=provider.resolveTool?provider.resolveTool(item.config.tools,event.name):item.config.tools.find(t=>t.name===event.name);
        if(!tool)throw fail('forbidden','Tool not allowed');
        const generation=item.generation;
        item.abort ??= new AbortController();
        send({type:'animation',state:'tool_running'});
        const result=await provider.invokeTool(tool,JSON.parse(event.arguments),{signal:item.abort.signal,config:item.config});
        if(generation!==item.generation)return;
        send({type:'realtime.event',event:{type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify(result)}}});
        send({type:'realtime.event',event:{type:'response.create'}});
      }
    }
    async function turn(message) {
      if(!['input.text','input.image','input.screenshot','input.audio'].includes(message.type))throw fail('invalid_message','Unsupported event type');
      let text=message.text ?? '', image;
      if(typeof text!=='string'||text.length>32000)throw fail('invalid_message','Invalid text');
      if(message.type==='input.text'&&!text.trim())throw fail('invalid_message','Text is required');
      if(['input.image','input.screenshot'].includes(message.type)) {
        image=message.dataUrl;
        if(typeof image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>maxPayload)throw fail('invalid_media','Expected a PNG, JPEG or WebP data URL');
      }
      if(message.type==='input.audio' && (!['audio/webm','audio/webm;codecs=opus','audio/ogg','audio/wav','audio/mp4'].includes(message.mimeType)||typeof message.data!=='string'||! /^[A-Za-z0-9+/]+=*$/.test(message.data)||message.data.length>maxPayload))throw fail('invalid_media','Unsupported recorded audio');
      item.abort?.abort();const generation=++item.generation;const controller=new AbortController();item.abort=controller;
      const turnId=randomUUID();item.turnId=turnId;
      const emit=data=>{if(item.generation===generation&&!controller.signal.aborted)send({...data,turnId});};
      const current=()=>item.generation===generation&&!controller.signal.aborted;
      try {
        emit({type:'animation',state:'thinking'});
        if(message.type==='input.audio')text=await provider.transcribe(Buffer.from(message.data,'base64'),message.mimeType,{signal:controller.signal,config:item.config});
        if(!current())return;
        emit({type:'transcript',role:'user',text:text || (message.type==='input.screenshot'?'Site screenshot':'Image'),final:true});
        const user={role:'user',content:image?[{type:'text',text:text||'Describe this image'},{type:'image_url',image_url:{url:image}}]:text};
        const reply=await provider.respond({config:item.config,messages:[...item.history,user],signal:controller.signal,emit});
        if(!current())return;
        emit({type:'transcript',role:'assistant',text:reply,final:true});
        emit({type:'text',text:reply,final:true});
        item.history.push(user,{role:'assistant',content:reply});item.history=item.history.slice(-40);
        if(item.config.engine!=='openai-realtime') {emit({type:'animation',state:'speaking'});await provider.speak(reply,{config:item.config,signal:controller.signal,emit});}
        emit({type:'animation',state:'idle'});
      } catch(error) {if(current()){emit({type:'animation',state:'error'});emit({type:'error',code:error.code??'provider_error',message:error.code?error.message:'Voice provider failed'});}}
    }
  }
  const reaper=setInterval(()=>{for(const [id,item]of sessions)if(item.expires<Date.now()){item.abort?.abort();item.ws?.close(1000,'Session expired');sessions.delete(id);}},10000);reaper.unref();
  return {server,sessions,listen:(port=8081,host='127.0.0.1')=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:async()=>{clearInterval(reaper);for(const item of sessions.values()){item.abort?.abort();item.ws?.terminate();}sockets.close();await new Promise(resolve=>server.close(resolve));}};
}
