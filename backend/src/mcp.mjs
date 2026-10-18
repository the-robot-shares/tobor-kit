import {randomUUID} from 'node:crypto';
import {sse} from './providers.mjs';

/** Server-side Streamable HTTP client, pinned to MCP 2025-11-25. */
export class MCPClient {
  constructor({endpoint,headers={},fetchImpl=fetch,protocolVersion='2025-11-25'}) {
    this.endpoint=endpoint;this.headers={...headers};this.fetch=fetchImpl;this.protocolVersion=protocolVersion;this.initialized=false;
  }
  async rpc(method,params,{signal,notification=false,initialize=false}={}) {
    const id=notification?undefined:randomUUID();
    const response=await this.fetch(this.endpoint,{method:'POST',signal,headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...this.headers,...(!initialize?{'MCP-Protocol-Version':this.protocolVersion}:{}),...(this.sessionId?{'MCP-Session-Id':this.sessionId}:{})},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
    if(!response.ok)throw new Error(`MCP ${method} failed (${response.status})`);
    if(notification){await response.body?.cancel();return;}
    let packet;
    if(response.headers.get('content-type')?.includes('text/event-stream')) {for await(const event of sse(response.body))if(event.id===id){packet=event;break;}}
    else packet=await response.json();
    if(packet?.id!==id||packet?.error||!('result'in packet))throw new Error(`MCP ${method} returned an invalid result`);
    if(initialize)this.sessionId=response.headers.get('MCP-Session-Id');
    return packet.result;
  }
  async initialize(signal) {
    if(this.initialized)return;
    const result=await this.rpc('initialize',{protocolVersion:this.protocolVersion,capabilities:{},clientInfo:{name:'tobor-voice-backend',version:'0.1.0'}},{signal,initialize:true});
    if(result.protocolVersion!==this.protocolVersion)throw new Error('MCP protocol version is unsupported');
    await this.rpc('notifications/initialized',undefined,{signal,notification:true});this.initialized=true;
  }
  async listTools({signal}={}) {
    await this.initialize(signal);let cursor;const tools=[];
    for(let page=0;page<100;page++) {const result=await this.rpc('tools/list',cursor?{cursor}:{},{signal});tools.push(...(result.tools??[]));cursor=result.nextCursor;if(!cursor)return tools;}
    throw new Error('MCP tool inventory exceeded page limit');
  }
  async callTool(name,args,{signal}={}) {await this.initialize(signal);const result=await this.rpc('tools/call',{name,arguments:args},{signal});if(result.isError)throw new Error('MCP tool returned an error');return result;}
  async close() {if(this.sessionId)await this.fetch(this.endpoint,{method:'DELETE',signal:AbortSignal.timeout(2000),headers:{...this.headers,'MCP-Session-Id':this.sessionId,'MCP-Protocol-Version':this.protocolVersion}});this.initialized=false;this.sessionId=null;}
}
