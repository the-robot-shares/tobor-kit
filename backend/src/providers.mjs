import {createHash} from 'node:crypto';
export const functionName=name=>/^[A-Za-z0-9_-]{1,64}$/.test(name)?name:`tool_${createHash('sha256').update(name).digest('hex').slice(0,24)}`;
/** Server-owned endpoints and credentials. No request may replace these values. */
export class OpenAICompatibleProvider {
  constructor({baseUrl='https://api.openai.com/v1',apiKey,openAIKey=apiKey,openAIBaseUrl='https://api.openai.com/v1',elevenLabsKey,elevenLabsBaseUrl='https://api.elevenlabs.io/v1',voice='alloy',elevenLabsVoice,fetchImpl=fetch,maxToolRounds=4}={}) {
    Object.assign(this,{baseUrl:baseUrl.replace(/\/$/,''),apiKey,openAIKey,openAIBaseUrl:openAIBaseUrl.replace(/\/$/,''),elevenLabsKey,elevenLabsBaseUrl:elevenLabsBaseUrl.replace(/\/$/,''),voice,elevenLabsVoice,fetch:fetchImpl,maxToolRounds});
  }
  resolveTool(tools,name) {return tools.find(t=>functionName(t.name)===name);}
  async request(url,body,{signal,key=this.apiKey,headers={}}={}) {
    if(!key)throw Object.assign(new Error('Provider credentials are not configured'),{code:'provider_unconfigured'});
    const response=await this.fetch(url,{method:'POST',signal,headers:{authorization:`Bearer ${key}`,'content-type':'application/json',...headers},body:JSON.stringify(body)});
    if(!response.ok)throw Object.assign(new Error(`Provider request failed (${response.status})`),{code:'provider_error'});
    return response;
  }
  async respond({config,messages,signal,emit}) {
    const conversation=[{role:'system',content:config.systemPrompt},...messages];
    const definitions=config.tools.map(t=>({type:'function',function:{name:functionName(t.name),description:t.description??'',parameters:t.inputSchema??{type:'object',properties:{}}}}));
    for(let round=0;round<=this.maxToolRounds;round++) {
      signal.throwIfAborted();
      const response=await this.request(`${this.baseUrl}/chat/completions`,{model:config.model,messages:conversation,stream:true,...(definitions.length?{tools:definitions}:{} )},{signal});
      let text='',calls=[];
      for await(const event of sse(response.body)) {
        signal.throwIfAborted();
        const delta=event.choices?.[0]?.delta;
        if(!delta)continue;
        if(typeof delta.content==='string'){text+=delta.content;emit({type:'text',text:delta.content,delta:true,final:false});}
        for(const part of delta.tool_calls??[]) {
          const index=part.index??0;
          if(index<0||index>99)throw new Error('Too many tool calls');
          const call=calls[index]??={id:'',type:'function',function:{name:'',arguments:''}};
          if(part.id)call.id=part.id;
          if(part.function?.name)call.function.name+=part.function.name;
          if(part.function?.arguments)call.function.arguments+=part.function.arguments;
          if(call.function.arguments.length>65536)throw new Error('Tool arguments too large');
        }
      }
      calls=calls.filter(Boolean);
      if(!calls.length)return text;
      if(round===this.maxToolRounds)throw Object.assign(new Error('Tool round limit exceeded'),{code:'tool_limit'});
      conversation.push({role:'assistant',content:text||null,tool_calls:calls});
      for(const call of calls) {
        signal.throwIfAborted();
        const tool=this.resolveTool(config.tools,call.function.name);
        if(!tool)throw Object.assign(new Error('Model requested a tool outside the session allowlist'),{code:'tool_forbidden'});
        emit({type:'animation',state:'tool_running'});
        const result=await this.invokeTool(tool,JSON.parse(call.function.arguments||'{}'),{signal,config});
        signal.throwIfAborted();
        conversation.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
        emit({type:'animation',state:'thinking'});
      }
    }
    throw new Error('Unreachable tool loop');
  }
  async invokeTool(tool,args,{signal,config}) {
    signal.throwIfAborted();
    if(typeof tool.invoke==='function')return tool.invoke(args,{signal,organization:config.organization,project:config.project});
    if(!tool.endpoint)throw Object.assign(new Error('Tool has no server adapter'),{code:'tool_unconfigured'});
    if(tool.stateless !== true) {
      const {MCPClient}=await import('./mcp.mjs');
      const client=new MCPClient({endpoint:tool.endpoint,headers:tool.headers,fetchImpl:this.fetch});
      try {return await client.callTool(tool.remoteName??tool.name,args,{signal});}
      finally {await client.close().catch(()=>{});}
    }
    // Explicit stateless/preinitialized legacy endpoints are supplied only by the host.
    const response=await this.fetch(tool.endpoint,{method:'POST',signal,headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...(tool.headers??{})},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name:tool.remoteName??tool.name,arguments:args}})});
    if(!response.ok)throw Object.assign(new Error('MCP invocation failed'),{code:'tool_error'});
    let packet;
    if(response.headers.get('content-type')?.includes('text/event-stream')) {for await(const event of sse(response.body))if(event.result||event.error){packet=event;break;}}
    else packet=await response.json();
    if(packet?.error || packet?.result?.isError)throw Object.assign(new Error('MCP tool returned an error'),{code:'tool_error'});
    if(!packet || !('result' in packet))throw Object.assign(new Error('MCP response is invalid'),{code:'tool_error'});
    return packet.result;
  }
  async transcribe(bytes,mimeType,{signal}) {
    if(!this.openAIKey)throw Object.assign(new Error('STT credentials are not configured'),{code:'provider_unconfigured'});
    const form=new FormData();form.set('model','gpt-4o-mini-transcribe');form.set('file',new Blob([bytes],{type:mimeType}),`recording.${mimeType.includes('wav')?'wav':mimeType.includes('mp4')?'mp4':mimeType.includes('ogg')?'ogg':'webm'}`);
    const response=await this.fetch(`${this.openAIBaseUrl}/audio/transcriptions`,{method:'POST',signal,headers:{authorization:`Bearer ${this.openAIKey}`},body:form});
    if(!response.ok)throw Object.assign(new Error('Transcription failed'),{code:'provider_error'});
    const data=await response.json();if(typeof data.text!=='string')throw new Error('Missing transcript');return data.text;
  }
  async speak(text,{config,signal,emit}) {
    let response;
    if(config.engine==='elevenlabs') {
      if(!this.elevenLabsKey||!(config.voice||this.elevenLabsVoice))throw Object.assign(new Error('ElevenLabs voice and credentials are required'),{code:'provider_unconfigured'});
      response=await this.fetch(`${this.elevenLabsBaseUrl}/text-to-speech/${encodeURIComponent(config.voice||this.elevenLabsVoice)}/stream?output_format=pcm_24000`,{method:'POST',signal,headers:{'xi-api-key':this.elevenLabsKey,'content-type':'application/json'},body:JSON.stringify({text,model_id:config.ttsModel||'eleven_flash_v2_5'})});
    } else {
      response=await this.request(`${this.openAIBaseUrl}/audio/speech`,{model:config.ttsModel||'gpt-4o-mini-tts',voice:config.voice||this.voice,input:text,response_format:'pcm'},{signal,key:this.openAIKey});
    }
    if(!response.ok||!response.body)throw Object.assign(new Error('Speech synthesis failed'),{code:'provider_error'});
    // Provider chunks may split a 16-bit sample. Retain the odd byte to preserve PCM alignment.
    let pending=Buffer.alloc(0);
    for await(const chunk of response.body) {
      signal.throwIfAborted();pending=Buffer.concat([pending,Buffer.from(chunk)]);
      const count=pending.length-(pending.length%2);
      if(count)emit({type:'audio',data:pending.subarray(0,count).toString('base64'),mimeType:'audio/pcm',sampleRate:24000});
      pending=pending.subarray(count);
    }
  }
  async mintRealtime(config) {
    const tools=config.tools.map(t=>({type:'function',name:functionName(t.name),description:t.description??'',parameters:t.inputSchema??{type:'object',properties:{}}}));
    const response=await this.request(`${this.openAIBaseUrl}/realtime/client_secrets`,{session:{type:'realtime',model:config.model,instructions:config.systemPrompt,tools,audio:{input:{transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'server_vad',interrupt_response:true,create_response:true}},output:{voice:config.voice||'marin'}}}},{key:this.openAIKey,signal:AbortSignal.timeout(30000)});
    const result=await response.json();if(typeof result.value!=='string'||!result.value)throw new Error('Realtime credential missing');
    return {token:result.value,url:`${this.openAIBaseUrl}/realtime/calls`,model:config.model,voice:config.voice||'marin',expiresAt:result.expires_at};
  }
}

/** Incremental SSE decoder handles CRLF and fragmented UTF-8. */
export async function* sse(body) {
  if(!body)throw new Error('Provider stream unavailable');
  const decoder=new TextDecoder();let buffer='';
  for await(const chunk of body) {
    buffer+=decoder.decode(chunk,{stream:true});
    if(buffer.length>2*1024*1024)throw new Error('Provider frame too large');
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))) {
      const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
      const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(!data)continue;if(data==='[DONE]')return;
      yield JSON.parse(data);
    }
  }
  if(buffer.trim())throw new Error('Provider stream ended mid-frame');
}
