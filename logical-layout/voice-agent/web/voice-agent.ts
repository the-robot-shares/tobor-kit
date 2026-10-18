/** Reusable multimodal voice agent. Provider secrets remain on the configured backend. */
import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import {property, state} from "lit/decorators.js";
import { emit } from "../../events.js";
import { isGuideState, type GuideState } from "../../types.js";
import "../robot-avatar/robot-avatar.js";
import { connectOpenAIRealtime, statusFromRealtimeEvent, type OpenAIRealtimeSession, type RealtimeServerEvent, type RealtimeUiStatus } from "../voice-session/openai-realtime.js";
import type { VoiceEngine, VoiceAgentConfig, AvatarGroup, ContextAction, AgentTranscript, AgentServerEvent } from "./types.js";
import {defineElement} from '../../define.js';
export * from "./types.js";

export function createAvatarGroups(baseUrl: string): AvatarGroup[] {
  return ["orbit", "pip", "nova"].map(id => ({id,label:id[0].toUpperCase()+id.slice(1),default:{src:new URL(`avatars/${id}/states.png`,baseUrl).href,columns:4,rows:2,column:0,row:0},states:Object.fromEntries(["idle","listening","thinking","speaking","tool_running","error","offline"].map((state,index)=>[state,{src:new URL(`avatars/${id}/states.png`,baseUrl).href,columns:4,rows:2,column:index%4,row:Math.floor(index/4)}]))}));
}
const MODULE_URL = import.meta.url;
const ACTIONS: ContextAction[] = ["configure-model", "configure-prompt", "configure-tools", "configure-avatar", "copy-transcript", "clear-transcript", "disconnect"];
const CONFIG_KEYS = ["organization", "project", "backendUrl", "backend", "engine", "model", "tools", "mcpTools", "systemPrompt", "voice", "ttsModel"];
@defineElement("tobor-voice-agent")
export class ToborVoiceAgent extends LitElement {
  static override styles = css`
    :host { display:block; font:14px/1.5 system-ui,sans-serif; color:var(--tobor-agent-color,#e8edf7); }
    .panel { border:1px solid var(--tobor-agent-border,#34425a); background:var(--tobor-agent-background,#101827); border-radius:18px; padding:20px; max-width:800px; }
    header,.controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; } header h2 { margin:0; font-size:20px; } header p { margin:2px 0; }
    button,input,textarea,select { font:inherit; color:inherit; background:#1e293b; border:1px solid #53637c; border-radius:7px; padding:8px 12px; }
    button { cursor:pointer; } button:disabled { opacity:.5; cursor:default; } :focus-visible { outline:3px solid #67dce9; outline-offset:2px; }
    textarea { box-sizing:border-box; display:block; width:100%; min-height:90px; max-height:65vh; resize:both; margin:12px 0; }
    .controls label { min-width:0;max-width:100%; } input[type="file"] { width:100%;min-width:0; }
    .transcript { max-height:300px; min-height:80px; overflow:auto; margin:16px 0; } .transcript p { white-space:pre-wrap; overflow-wrap:anywhere; margin:8px 0; }
    .error { color:#ffb4b4; } .menu { display:flex; flex-wrap:wrap; gap:8px; padding:12px 0; } .config { border-top:1px solid #53637c; margin-top:12px; padding-top:12px; } label { display:block; margin:8px 0; } input,select { max-width:100%; box-sizing:border-box; } .pending { color:#ffd69b; }
  `;
  @property() organization = "";
  @property() project = "";
  @property({attribute:"backend-url"}) backendUrl = "";
  @property() backend = "litellm";
  @property() engine: VoiceEngine = "openai-realtime";
  @property() model = "gpt-realtime-mini";
  @property() voice = "";
  @property({attribute:"tts-model"}) ttsModel = "";
  @property({attribute:false}) tools: unknown[] = [];
  @property({attribute:false}) mcpTools: string[] = [];
  @property({attribute:"system-prompt"}) systemPrompt = "You are a helpful voice assistant.";
  @property({attribute:false}) avatarGroups: AvatarGroup[] = createAvatarGroups(new URL("../../", MODULE_URL).href);
  @property({attribute:"avatar-group"}) avatarGroup = "";
  @property({attribute:false}) avatar?: AvatarGroup;
  @property({attribute:false}) contextActions: ContextAction[] = [...ACTIONS];
  @property() label = "Voice agent";
  @property({attribute:false}) fetchImpl: typeof fetch = (...args) => fetch(...args);
  @property({attribute:false}) socketFactory: (url:string)=>WebSocket = url => new WebSocket(url);
  @property({attribute:false}) realtimeConnector = connectOpenAIRealtime;
  @state() connection: "disconnected" | "connecting" | "ready" = "disconnected";
  @state() agentState: GuideState = "idle";
  @state() transcript: AgentTranscript[] = [];
  @state() private draft = "";
  @state() private error = "";
  @state() private menu = false;
  @state() private configuring: ContextAction | "" = "";
  @state() private pending = false;
  @state() private recording = false;
  #socket?: WebSocket;
  #epoch = 0;
  #abort?: AbortController;
  #realtime?: OpenAIRealtimeSession;
  #openingRealtime?: OpenAIRealtimeSession;
  #realtimePending?: Promise<void>;
  #credential?: {token:string;url?:string;model?:string;voice?:string};
  #recorder?: MediaRecorder;
  #stream?: MediaStream;
  #audio?: HTMLAudioElement;
  #audioUrls = new Set<string>();
  #audioQueue: {data:string;mimeType:string;sampleRate?:number}[] = [];
  #audioContext?: AudioContext;
  #pcmSources = new Set<AudioBufferSourceNode>();
  #pcmTime = 0;
  #afterAudioState?: GuideState;
  #cancelled = new Set<string>();
  #turnId?: string;
  #sessionId?: string;
  #readyTimer?: ReturnType<typeof setTimeout>;
  #realtimeStatus: RealtimeUiStatus = "idle";
  get config(): VoiceAgentConfig { return {organization:this.organization,project:this.project,backend:this.backend,engine:this.engine,model:this.model,tools:this.tools,mcpTools:this.mcpTools,systemPrompt:this.systemPrompt,voice:this.voice,ttsModel:this.ttsModel}; }
  get org():string { return this.organization; } set org(value:string) { this.organization=value; }
  get voiceMode():VoiceEngine { return this.engine; } set voiceMode(value:VoiceEngine) { this.engine=value; }
  override willUpdate(changed:PropertyValues):void {
    if (this.connection !== "disconnected" && CONFIG_KEYS.some(key=>changed.has(key))) this.pending=true;
    if (this.configuring && !this.contextActions.includes(this.configuring)) this.configuring="";
  }
  override disconnectedCallback():void { this.disconnect(); super.disconnectedCallback(); }
  async connect():Promise<void> {
    this.disconnect(); const epoch=this.#epoch; this.connection="connecting"; this.pending=false; this.error=""; this.#setState("thinking"); this.#abort=new AbortController();
    try {
      const base=new URL(this.backendUrl || location.origin, location.href);
      const response=await this.fetchImpl(`${base.href.replace(/\/$/,"")}/voice/sessions`, {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(this.config),signal:this.#abort.signal});
      if (!response.ok) throw new Error(`Session initialization failed (${response.status})`);
      const result=await response.json() as {sessionId:string;websocketUrl:string;realtime?:{token:string;url?:string;model?:string;voice?:string}};
      if(epoch!==this.#epoch)return;
      if(!result.sessionId||!result.websocketUrl)throw new Error("Backend returned an incomplete voice session");
      this.#sessionId=result.sessionId; this.#credential=result.realtime;
      const url=new URL(result.websocketUrl,base); if(url.protocol==="http:")url.protocol="ws:"; if(url.protocol==="https:")url.protocol="wss:";
      if(!["ws:","wss:"].includes(url.protocol))throw new Error("Invalid WebSocket URL");
      const socket=this.socketFactory(url.href);this.#socket=socket;
      this.#readyTimer=setTimeout(()=>{if(epoch===this.#epoch && this.connection!=="ready")this.#fail("Session handshake timed out");},15000);
      socket.onmessage=event=>{if(epoch!==this.#epoch)return;try{this.#receive(JSON.parse(String(event.data)) as AgentServerEvent);}catch{this.#fail("Invalid backend message");}};
      socket.onerror=()=>{if(epoch===this.#epoch)this.#fail("Voice connection failed");};
      socket.onclose=()=>{if(epoch===this.#epoch){this.disconnect();this.#setState("offline");}};
    }catch(error){if(epoch===this.#epoch)this.#fail(error instanceof Error?error.message:String(error));}
  }
  disconnect():void {
    ++this.#epoch;clearTimeout(this.#readyTimer);this.#abort?.abort();this.#openingRealtime?.stop();this.#openingRealtime=undefined;this.#realtimePending=undefined;this.#socket?.close();this.#socket=undefined;this.#realtime?.stop();this.#realtime=undefined;this.#credential=undefined;
    this.#stopRecording(false);this.#stopAudio();void this.#audioContext?.close();this.#audioContext=undefined;this.connection="disconnected";this.#sessionId=undefined;this.#cancelled.clear();this.#turnId=undefined;this.#setState("idle");
  }
  interrupt():void {
    if(this.#turnId)this.#cancelled.add(this.#turnId);if(this.#cancelled.size>100)this.#cancelled.delete(this.#cancelled.values().next().value!);this.#stopAudio();
    this.#realtime?.sendEvent({type:"response.cancel"});this.#realtime?.sendEvent({type:"output_audio_buffer.clear"});
    if(this.#realtime?.audioEl){this.#realtime.audioEl.pause();this.#realtime.audioEl.currentTime=0;}
    this.#send({type:"interrupt",turnId:this.#turnId});this.#setState(this.recording?"listening":"idle");
  }
  async sendText(text=this.draft):Promise<void> {
    const epoch=this.#epoch;
    if(!text.trim()||this.connection!=="ready"||this.pending)return;
    if(this.engine==="openai-realtime" && !this.#realtime){try{await this.#startRealtime(false);}catch(error){if(epoch===this.#epoch)this.#report(error);return;}}
    if(epoch!==this.#epoch||this.connection!=="ready"||this.pending)return;
    {}
    this.interrupt();this.draft="";
    if(this.#realtime){this.#realtime.sendEvent({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text}]}});this.#realtime.sendEvent({type:"response.create"});}
    else this.#send({type:"input.text",text});
    if(this.#realtime)this.#upsert({id:crypto.randomUUID(),role:"user",text,final:true});
  }
  async sendImage(dataUrl:string,kind:"image"|"screenshot"="image",text=this.draft):Promise<void>{
    const epoch=this.#epoch;
    if(!/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl))throw new Error("Use a PNG, JPEG or WebP image");
    if(dataUrl.length+text.length>8_000_000)throw new Error("Image and message exceed the 8 MB transport limit");
    if(this.connection!=="ready"||this.pending)return;
    if(this.engine==="openai-realtime" && !this.#realtime){try{await this.#startRealtime(false);}catch(error){if(epoch===this.#epoch)this.#report(error);return;}}
    if(epoch!==this.#epoch||this.connection!=="ready"||this.pending)return;
    this.interrupt();if(!this.#realtime)this.#send({type:`input.${kind}`,dataUrl,text});this.draft="";
    if(this.#realtime){this.#upsert({id:crypto.randomUUID(),role:"user",text:text||`[${kind}]`,final:true});this.#realtime.sendEvent({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_image",image_url:dataUrl},...(text?[{type:"input_text",text}]:[])]}});this.#realtime.sendEvent({type:"response.create"});}
  }
  async captureScreenshot():Promise<void>{
    let stream:MediaStream|undefined;const epoch=this.#epoch;
    try{stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const video=document.createElement("video");video.srcObject=stream;await video.play();if(epoch!==this.#epoch){video.srcObject=null;return;}
      const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;if(!canvas.width)throw new Error("No screenshot frame available");canvas.getContext("2d")!.drawImage(video,0,0);if(epoch===this.#epoch)await this.sendImage(canvas.toDataURL("image/png"),"screenshot");video.srcObject=null;
    }catch(error){if(epoch===this.#epoch)this.#report(error);}finally{stream?.getTracks().forEach(track=>track.stop());}
  }
  async toggleVoice():Promise<void>{
    if(this.connection!=="ready"||this.pending)return;
    if(this.recording){if(this.#realtime){this.#realtime.localStream?.getTracks().forEach(t=>t.stop());this.#realtime.localStream=null;this.recording=false;}else this.#stopRecording(true);return;}
    const epoch=this.#epoch;this.interrupt();
    try{
      if(this.engine==="openai-realtime"){
        if(this.#realtimePending)await this.#realtimePending;if(epoch!==this.#epoch)return;
        if(this.#realtime){
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(epoch!==this.#epoch){stream.getTracks().forEach(t=>t.stop());return;}
          const sender=this.#realtime.pc?.getTransceivers().find(t=>t.receiver.track.kind==="audio");
          if(!sender)throw new Error("Realtime audio sender unavailable");sender.direction="sendrecv";await sender.sender.replaceTrack(stream.getAudioTracks()[0]);if(epoch!==this.#epoch){stream.getTracks().forEach(t=>t.stop());return;}this.#realtime!.localStream=stream;
        }else await this.#startRealtime(true);
        if(epoch!==this.#epoch)return;this.recording=true;
      }else{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(epoch!==this.#epoch){stream.getTracks().forEach(t=>t.stop());return;}
        this.#stream=stream;const recorder=new MediaRecorder(stream);this.#recorder=recorder;const chunks:Blob[]=[];
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onstop=()=>{if(epoch!==this.#epoch)return;const blob=new Blob(chunks,{type:recorder.mimeType});void this.#blobUrl(blob).then(dataUrl=>{if(epoch===this.#epoch)this.#send({type:"input.audio",data:dataUrl.split(",")[1],mimeType:blob.type,final:true});});};
        recorder.start();this.recording=true;
      }this.#setState("listening");
    }catch(error){if(epoch===this.#epoch)this.#report(error);}
  }
  #startRealtime(microphone:boolean):Promise<void>{
    if(this.#realtimePending)return this.#realtimePending;
    const task=this.#openRealtime(microphone);this.#realtimePending=task;
    void task.finally(()=>{if(this.#realtimePending===task)this.#realtimePending=undefined;}).catch(()=>undefined);
    return task;
  }
  async #openRealtime(microphone:boolean):Promise<void>{
    if(!this.#credential?.token)throw new Error("Backend did not issue a realtime credential");const credential=this.#credential,epoch=this.#epoch,signal=this.#abort!.signal;
    const session=await this.realtimeConnector({microphone,audioHost:this,model:this.model,voice:this.voice,mintSession:async()=>({client_secret:credential.token,calls_url:credential.url,model:credential.model,voice:credential.voice}),onEvent:event=>{if(epoch===this.#epoch)this.#onRealtime(event);}});
    if(epoch!==this.#epoch){session.stop();throw new Error("Session was disconnected");}
    this.#openingRealtime=session;
    try {
      if(session.dc && session.dc.readyState!=="open")await new Promise<void>((resolve,reject)=>{
        const dc=session.dc!;
        const finish=(error?:Error)=>{clearTimeout(timer);dc.removeEventListener("open",opened);dc.removeEventListener("close",closed);signal.removeEventListener("abort",aborted);error?reject(error):resolve();};
        const opened=()=>finish(),closed=()=>finish(new Error("Realtime channel closed")),aborted=()=>finish(new Error("Session was disconnected"));
        const timer=setTimeout(()=>finish(new Error("Realtime channel timed out")),15000);
        dc.addEventListener("open",opened,{once:true});dc.addEventListener("close",closed,{once:true});signal.addEventListener("abort",aborted,{once:true});if(signal.aborted)aborted();
      });
      if(epoch!==this.#epoch)throw new Error("Session was disconnected");
      this.#realtime=session;
      session.dc?.addEventListener("close",()=>{if(epoch===this.#epoch){this.#realtime=undefined;this.recording=false;this.#report(new Error("Realtime channel closed; reconnect to continue"));}});
    }catch(error){session.stop();throw error;}finally{if(this.#openingRealtime===session)this.#openingRealtime=undefined;}
  }
  #stopRecording(submit:boolean):void {if(this.#recorder){if(!submit)this.#recorder.onstop=null;if(this.#recorder.state!=="inactive")this.#recorder.stop();}this.#recorder=undefined;this.#stream?.getTracks().forEach(t=>t.stop());this.#stream=undefined;this.recording=false;}
  #onRealtime(event:RealtimeServerEvent):void {
    this.#realtimeStatus=statusFromRealtimeEvent(event,this.#realtimeStatus);this.#setState(this.#realtimeStatus==="connecting"?"thinking":this.#realtimeStatus);
    if(event.type==="response.created" && this.#realtime?.audioEl)void this.#realtime.audioEl.play().catch(()=>undefined);
    this.#send({type:"realtime.event",event});
  }
  #send(message:Record<string,unknown>):void {if(this.connection==="ready"&&this.#socket?.readyState===WebSocket.OPEN)this.#socket.send(JSON.stringify(message));}
  #receive(event:AgentServerEvent):void {
    if(event.sessionId&&event.sessionId!==this.#sessionId)return;
    if(event.type==="ready"||event.type==="session.ready"){clearTimeout(this.#readyTimer);this.connection="ready";this.#setState("idle");emit(this,"tobor-agent-ready",{sessionId:this.#sessionId});return;}
    if(this.connection!=="ready")return;
    if(event.turnId&&this.#cancelled.has(event.turnId))return;
    if(event.turnId)this.#turnId=event.turnId;
    if(event.type==="animation"&&isGuideState(event.state)){if(event.state==="idle"&&(this.#pcmSources.size||this.#audio))this.#afterAudioState=event.state;else this.#setState(event.state);}
    if(event.type==="transcript"||event.type==="text"){
      const id=`${event.turnId??"current"}:${event.role??"assistant"}`;const previous=this.transcript.find(item=>item.id===id);
      this.#upsert({id,role:event.role??"assistant",text:(event.delta?previous?.text??"":"")+(event.text??""),final:event.final??!event.delta});
    }
    if(event.type==="audio"&&event.data){this.#audioQueue.push({data:event.data,mimeType:event.mimeType??"audio/mpeg",sampleRate:typeof event.sampleRate==="number"?event.sampleRate:24000});this.#playNext();}
    if(event.type==="realtime.event"&&event.event)this.#realtime?.sendEvent(event.event as RealtimeServerEvent);
    if(event.type==="error")this.#report(new Error(event.message??event.code??"Voice backend error"));
    emit(this,"tobor-agent-event",event);
  }
  #upsert(entry:AgentTranscript):void {const index=this.transcript.findIndex(item=>item.id===entry.id);this.transcript=index<0?[...this.transcript,entry]:this.transcript.map((item,i)=>i===index?entry:item);emit(this,"tobor-agent-transcript",{entry,transcript:this.transcript});}
  #setState(state:GuideState):void {this.agentState=state;emit(this,"tobor-agent-state",{state});}
  #report(error:unknown):void {this.error=error instanceof Error?error.message:String(error);this.#setState("error");emit(this,"tobor-agent-error",{message:this.error});}
  #fail(message:string):void {this.disconnect();this.#report(new Error(message));}
  #stopAudio():void {this.#afterAudioState=undefined;for(const source of this.#pcmSources){try{source.stop();}catch{}}this.#pcmSources.clear();this.#pcmTime=0;this.#audioQueue=[];if(this.#audio){this.#audio.pause();this.#audio.src="";this.#audio=undefined;}for(const url of this.#audioUrls)URL.revokeObjectURL(url);this.#audioUrls.clear();}
  #playNext():void {
    if(this.#audio||!this.#audioQueue.length)return;const item=this.#audioQueue.shift()!;
    try{if(item.mimeType==="audio/pcm"){
      const bytes=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));if(bytes.length%2)throw new Error("Incomplete PCM sample");
      const context=this.#audioContext??=new AudioContext();void context.resume().catch(error=>this.#report(error));
      const buffer=context.createBuffer(1,bytes.length/2,item.sampleRate??24000),view=new DataView(bytes.buffer),channel=buffer.getChannelData(0);
      for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;
      const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);this.#pcmSources.add(source);source.onended=()=>{this.#pcmSources.delete(source);source.disconnect();if(!this.#pcmSources.size&&this.#afterAudioState){this.#setState(this.#afterAudioState);this.#afterAudioState=undefined;}};
      const start=Math.max(context.currentTime,this.#pcmTime);source.start(start);this.#pcmTime=start+buffer.duration;this.#playNext();return;
    }if(!/^audio\//.test(item.mimeType))throw new Error("Invalid audio content type");const bytes=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:item.mimeType}));this.#audioUrls.add(url);const audio=new Audio(url);this.#audio=audio;
      const finish=()=>{URL.revokeObjectURL(url);this.#audioUrls.delete(url);if(this.#audio===audio){this.#audio=undefined;this.#playNext();}};audio.onended=finish;audio.onerror=finish;void audio.play().catch(error=>{finish();this.#report(error);});
    }catch(error){this.#report(error);}
  }
  #blobUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read attachment"));reader.readAsDataURL(blob);});}
  async #upload(event:Event):Promise<void>{const epoch=this.#epoch;const input=event.target as HTMLInputElement;const file=input.files?.[0];try{if(file){const url=await this.#blobUrl(file);if(epoch===this.#epoch)await this.sendImage(url);}}catch(error){if(epoch===this.#epoch)this.#report(error);}input.value="";}
  #action(action:ContextAction):void {
    if(!this.contextActions.includes(action))return;
    if(action==="disconnect")this.disconnect();else if(action==="clear-transcript")this.transcript=[];else if(action==="copy-transcript")void navigator.clipboard.writeText(this.transcript.map(item=>`${item.role}: ${item.text}`).join("\n")).catch(error=>this.#report(error));else this.configuring=action;
    this.menu=false;
  }
  override render(){const ready=this.connection==="ready"&&!this.pending;const selected=this.avatar??this.avatarGroups.find(group=>group.id===this.avatarGroup)??this.avatarGroups[0];
    return html`<section class="panel" @contextmenu=${(e:MouseEvent)=>{if(this.contextActions.length){e.preventDefault();this.menu=true;}}} @keydown=${(e:KeyboardEvent)=>{if(e.key==="Escape"){this.menu=false;this.configuring="";}if(e.key==="ContextMenu"||(e.shiftKey&&e.key==="F10")){e.preventDefault();this.menu=true;}}}>
      <header><tobor-robot-avatar .state=${this.agentState} .avatar=${selected} .label=${this.label}></tobor-robot-avatar><div><h2>${this.label}</h2><p data-testid="agent-status" role="status">${this.connection} · ${this.agentState}</p><small>${this.engine} · ${this.model}</small></div></header>
      ${this.error?html`<p class="error" role="alert">${this.error}</p>`:nothing}
      ${this.pending?html`<p class="pending" data-testid="agent-pending">Configuration changed. Reconnect to apply.</p>`:nothing}
      <div class="controls"><button data-testid="agent-connect" @click=${()=>void this.connect()} ?disabled=${this.connection==="connecting"}>${this.connection==="ready"?"Reconnect":"Connect"}</button><button data-testid="agent-disconnect" ?disabled=${this.connection==="disconnected"} @click=${()=>this.disconnect()}>Disconnect</button>${this.contextActions.length?html`<button data-testid="agent-options" aria-expanded=${this.menu} @click=${()=>this.menu=!this.menu}>Options</button>`:nothing}</div>
      ${this.menu?html`<div class="menu" role="group" aria-label="Agent options">${this.contextActions.filter(action=>ACTIONS.includes(action)).map(action=>html`<button data-testid=${`agent-${action}`} @click=${()=>this.#action(action)}>${action.replaceAll("-"," ")}</button>`)}</div>`:nothing}
      ${this.#renderConfig()}
      <div class="transcript" data-testid="agent-transcript" role="log" aria-label="Conversation transcript" aria-live="polite">${this.transcript.length?this.transcript.map(item=>html`<p><strong>${item.role}:</strong> ${item.text}${item.final?nothing:html`<span aria-label="partial"> …</span>`}</p>`):html`<p>Your conversation will appear here.</p>`}</div>
      <label for="agent-input">Message</label><textarea id="agent-input" data-testid="agent-input" .value=${this.draft} @input=${(e:Event)=>this.draft=(e.target as HTMLTextAreaElement).value} @keydown=${(e:KeyboardEvent)=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();this.sendText();}}} placeholder="Type a message, attach an image or share a screenshot"></textarea>
      <div class="controls"><button data-testid="agent-send" ?disabled=${!ready||!this.draft.trim()} @click=${()=>this.sendText()}>Send</button><button data-testid="agent-mic" aria-pressed=${this.recording} ?disabled=${!ready} @click=${()=>void this.toggleVoice()}>${this.recording?"Stop microphone":"Microphone"}</button><button data-testid="agent-interrupt" ?disabled=${this.connection!=="ready"} @click=${()=>this.interrupt()}>Interrupt</button><label>Image <input data-testid="agent-image" type="file" accept="image/png,image/jpeg,image/webp" ?disabled=${!ready} @change=${(e:Event)=>void this.#upload(e)}></label><button data-testid="agent-screenshot" ?disabled=${!ready} @click=${()=>void this.captureScreenshot()}>Site screenshot</button></div>
      <slot name="footer"></slot>
    </section>`;
  }
  #renderConfig(){if(!this.configuring||!this.contextActions.includes(this.configuring))return nothing;
    const field=(name:"model"|"systemPrompt"|"voice"|"ttsModel",label:string)=>html`<label>${label}<textarea data-testid=${`agent-config-${name}`} .value=${this[name]} @change=${(e:Event)=>{this[name]=(e.target as HTMLTextAreaElement).value;}}></textarea></label>`;
    return html`<div class="config" data-testid="agent-config" role="region" aria-label="Agent configuration">
      ${this.configuring==="configure-model"?html`<label>Voice engine<select data-testid="agent-config-engine" .value=${this.engine} @change=${(e:Event)=>this.engine=(e.target as HTMLSelectElement).value as VoiceEngine}><option value="openai-realtime">OpenAI Realtime</option><option value="elevenlabs">ElevenLabs with interruption</option><option value="tts">TTS with interruption</option></select></label>${field("model","Model")}${field("voice","Voice (optional provider default)")}${field("ttsModel","Speech model (optional)")}`:nothing}
      ${this.configuring==="configure-prompt"?field("systemPrompt","System prompt"):nothing}
      ${this.configuring==="configure-tools"?html`<label>MCP tools (one per line)<textarea data-testid="agent-config-mcpTools" .value=${this.mcpTools.join("\n")} @change=${(e:Event)=>this.mcpTools=(e.target as HTMLTextAreaElement).value.split("\n").map(s=>s.trim()).filter(Boolean)}></textarea></label><p>Backend policy determines which requested tools are allowed.</p>`:nothing}
      ${this.configuring==="configure-avatar"?html`<label>Avatar group<select data-testid="agent-config-avatar" .value=${this.avatarGroup} @change=${(e:Event)=>this.avatarGroup=(e.target as HTMLSelectElement).value}>${this.avatarGroups.map(group=>html`<option value=${group.id}>${group.label??group.id}</option>`)}</select></label>`:nothing}
      <button @click=${()=>this.configuring=""}>Done</button></div>`;
  }
}
declare global { interface HTMLElementTagNameMap { "tobor-voice-agent":ToborVoiceAgent; } }
