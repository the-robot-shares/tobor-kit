import { fixture, expect, html } from "@open-wc/testing";
import { ToborVoiceAgent } from "../../voice-agent.js";
import { connectOpenAIRealtime, type OpenAIRealtimeSession } from "../../../voice-session/openai-realtime.js";
import { ToborRobotAvatar } from "../../../robot-avatar/robot-avatar.js";

class Socket {
  readyState=1; sent:Record<string,unknown>[]=[]; closed=false;
  onmessage:((event:{data:string})=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;
  send(data:string){this.sent.push(JSON.parse(data));}close(){this.closed=true;}
  receive(event:Record<string,unknown>){this.onmessage?.({data:JSON.stringify(event)});}
}
async function setup(){
  const el=await fixture<ToborVoiceAgent>(html`<tobor-voice-agent engine="tts" model="test-model" organization="org" project="project"></tobor-voice-agent>`);
  const sockets:Socket[]=[];let posted:Record<string,unknown>={};
  el.fetchImpl=async(_input,init)=>{posted=JSON.parse(String(init?.body));return new Response(JSON.stringify({sessionId:"s",websocketUrl:"ws://localhost/voice",realtime:{token:"ephemeral"}}));};
  el.socketFactory=()=>{const socket=new Socket();sockets.push(socket);return socket as unknown as WebSocket;};
  await el.connect();await el.updateComplete;return{el,sockets,get posted(){return posted;}};
}
describe("voice agent session boundaries",()=>{
  it("posts host configuration and gates input until backend ready",async()=>{
    const test=await setup();expect(test.posted).to.include({organization:"org",project:"project",engine:"tts",model:"test-model"});
    await test.el.sendText("before");expect(test.sockets[0].sent).to.have.length(0);
    test.sockets[0].receive({type:"ready",sessionId:"s"});await test.el.sendText("after");expect(test.sockets[0].sent.at(-1)).to.deep.equal({type:"input.text",text:"after"});
  });
  it("ignores cancelled turns and callbacks from disconnected sockets",async()=>{
    const{el,sockets}=await setup();const socket=sockets[0];socket.receive({type:"ready"});socket.receive({type:"transcript",turnId:"first",role:"assistant",text:"Hello"});el.interrupt();
    socket.receive({type:"transcript",turnId:"first",role:"assistant",text:"stale"});expect(el.transcript[0].text).to.equal("Hello");
    await el.connect();socket.receive({type:"animation",state:"speaking"});expect(el.agentState).not.to.equal("speaking");expect(socket.closed).to.equal(true);
  });
  it("marks changed configuration pending and blocks sends until reconnect",async()=>{
    const{el,sockets}=await setup();sockets[0].receive({type:"ready"});el.model="changed";await el.updateComplete;await el.updateComplete;
    await el.sendText("blocked");expect(sockets[0].sent).to.have.length(0);expect(el.shadowRoot!.querySelector('[data-testid="agent-pending"]')).to.exist;
  });
  it("does not expose host-disabled configuration actions",async()=>{
    const{el}=await setup();el.contextActions=["copy-transcript"];await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-testid="agent-options"]') as HTMLButtonElement).click();await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="agent-configure-model"]')).not.to.exist;
  });
  it("does not resurrect a removed element after pending session initialization",async()=>{
    const el=await fixture<ToborVoiceAgent>(html`<tobor-voice-agent engine="tts"></tobor-voice-agent>`);
    let resolve!:(value:Response)=>void;let opened=false;
    el.fetchImpl=()=>new Promise<Response>(done=>{resolve=done;});el.socketFactory=()=>{opened=true;return new Socket() as unknown as WebSocket;};
    const pending=el.connect();el.remove();resolve(new Response(JSON.stringify({sessionId:"late",websocketUrl:"ws://localhost/voice"})));await pending;
    expect(opened).to.equal(false);expect(el.connection).to.equal("disconnected");
  });
  it("stops microphone tracks when acquisition finishes after element removal",async()=>{
    const {el,sockets}=await setup();sockets[0].receive({type:"ready"});
    const original=navigator.mediaDevices.getUserMedia;let resolve!:(stream:MediaStream)=>void;let stopped=false;
    navigator.mediaDevices.getUserMedia=()=>new Promise<MediaStream>(done=>{resolve=done;});
    try{const pending=el.toggleVoice();el.remove();resolve({getTracks:()=>[{stop:()=>{stopped=true;}}]} as unknown as MediaStream);await pending;expect(stopped).to.equal(true);expect(el.connection).to.equal("disconnected");}finally{navigator.mediaDevices.getUserMedia=original;}
  });
  it("cancels an old realtime handshake without changing the replacement session or sending stale inputs",async()=>{
    const {el,sockets}=await setup();el.engine="openai-realtime";await el.updateComplete;await el.connect();sockets.at(-1)!.receive({type:"ready"});
    class Channel extends EventTarget {readyState="connecting";}
    const channel=new Channel();let connections=0,stopped=false;const providerEvents:unknown[]=[];
    el.realtimeConnector=async()=>{connections++;return {dc:channel,stop(){stopped=true;channel.dispatchEvent(new Event("close"));},sendEvent(event:unknown){providerEvents.push(event);}} as unknown as OpenAIRealtimeSession;};
    const text=el.sendText("old text"),image=el.sendImage("data:image/png;base64,AA==");await Promise.resolve();await Promise.resolve();
    expect(connections).to.equal(1);await el.connect();sockets.at(-1)!.receive({type:"ready"});await Promise.all([text,image]);
    channel.readyState="open";channel.dispatchEvent(new Event("open"));
    expect(stopped).to.equal(true);expect(el.connection).to.equal("ready");expect(el.agentState).to.equal("idle");expect(providerEvents).to.have.length(0);expect(sockets.at(-1)!.sent).to.have.length(0);
  });
  it("negotiates a sendrecv transceiver for text-only realtime without requesting microphone",async()=>{
    const directions:string[]=[];let microphoneRequested=false;let closed=false;
    class Peer {
      addTransceiver(_kind:string,options:{direction:string}){directions.push(options.direction);}
      createDataChannel(){return {addEventListener(){},close(){},readyState:"open",send(){}};}
      async createOffer(){return {sdp:"v=0"};}async setLocalDescription(){}async setRemoteDescription(){}close(){closed=true;}
    }
    const session=await connectOpenAIRealtime({microphone:false,mintSession:async()=>({client_secret:"ephemeral"}),media:{getUserMedia:async()=>{microphoneRequested=true;throw new Error("unexpected mic");},RTCPeerConnection:Peer as unknown as typeof RTCPeerConnection},postOfferToOpenAI:async()=>"v=0"});
    expect(directions).to.deep.equal(["sendrecv"]);expect(microphoneRequested).to.equal(false);session.stop();expect(closed).to.equal(true);
  });
  it("renders custom SVG as an image resource with state fallback and reduced motion",async()=>{
    const avatar=await fixture<ToborRobotAvatar>(html`<tobor-robot-avatar></tobor-robot-avatar>`);avatar.avatar={id:"custom",default:{src:"/custom.svg"},states:{thinking:{src:"/thinking.png"}}};avatar.reducedMotion="force_static";avatar.state="thinking";await avatar.updateComplete;
    expect(avatar.shadowRoot!.querySelector('[part="image"]')?.getAttribute("style")).to.contain("thinking.png");expect(avatar.dataset.motion).to.equal("static");avatar.state="speaking";await avatar.updateComplete;expect(avatar.shadowRoot!.querySelector('[part="image"]')?.getAttribute("style")).to.contain("custom.svg");
  });
});
