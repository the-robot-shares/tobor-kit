/// <reference types="cypress" />
// BDD acceptance against the real toolkit and HTTP/WebSocket gateway.
// Only browser media devices are simulated; the provider is explicitly test-only.
const el = () => cy.get('tobor-voice-agent');
const control = (id: string) => el().shadow().find(`[data-testid="agent-${id}"]`);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1kAAAAASUVORK5CYII=';
function visit() {
  cy.intercept('POST', 'http://127.0.0.1:8081/voice/sessions').as('initialize');
  cy.visit('/', { onBeforeLoad(win) {
    const state = { sent: [] as any[], received: [] as any[], stopped: 0, playbackStopped: 0 };
    (win as any).voiceEvidence = state;
    const createSource=win.AudioContext.prototype.createBufferSource;
    win.AudioContext.prototype.createBufferSource=function(){const source=createSource.call(this);const stop=source.stop.bind(source);source.stop=(when?:number)=>{state.playbackStopped++;stop(when);};return source;};
    const NativeSocket = win.WebSocket;
    class ObservedSocket extends NativeSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', event => state.received.push(JSON.parse(String(event.data))));
      }
      override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === 'string') state.sent.push(JSON.parse(data));
        super.send(data);
      }
    }
    win.WebSocket = ObservedSocket;
    // Native canvas stream produces an actual screenshot frame without OS UI.
    const media = () => {
      const canvas = win.document.createElement('canvas'); canvas.width=64; canvas.height=64;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#00aabb';ctx.fillRect(0,0,64,64);
      const stream=canvas.captureStream(5);
      stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{state.stopped++;stop();};});
      return stream;
    };
    Object.defineProperty(win.navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>media()});
    Object.defineProperty(win.navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>media()});
    class Recorder {
      state='inactive';mimeType='audio/webm';ondataavailable?:Function;onstop?:Function;
      start(){this.state='recording';}
      stop(){this.state='inactive';this.ondataavailable?.({data:new win.Blob(['fixture voice'],{type:this.mimeType})});this.onstop?.();}
    }
    (win as any).MediaRecorder=Recorder;
  }});
  el().should('exist');
  control('connect').should('be.visible');
}
function connect() { control('connect').click(); cy.wait('@initialize').its('response.statusCode').should('eq',201); control('status').should('contain','ready'); }
function send(text:string){control('input').type(text);control('send').click();}

describe('Reusable voice agent — direct toolkit BDD',()=>{
  beforeEach(visit);
  afterEach(()=>el().then(($el)=>($el[0] as any).disconnect()));

  it('Given configuration fields, when connected, then the backend receives the complete scope and capabilities',()=>{
    connect();
    cy.get('@initialize').its('request.body').should('deep.include',{organization:'noizu-labs',project:'noizu-infra',backend:'litellm',engine:'tts',model:'fixture-model',tools:['fixture.echo'],mcpTools:[],systemPrompt:'You are a helpful voice assistant in the toolkit playground.'});
    send('Hello toolkit');
    control('transcript').should('contain','Hello toolkit').and('contain','Sandbox voice reply: Hello toolkit');
    cy.screenshot('voice-agent-desktop-orbit');
    el().then(($el)=>expect(($el[0] as any).transcript.filter((x:any)=>x.role==='assistant')).to.have.length(1));
    cy.window().then(win=>{const evidence=(win as any).voiceEvidence;expect(evidence.sent.some((x:any)=>x.type==='input.text')).eq(true);expect(evidence.received.some((x:any)=>x.type==='audio')).eq(true);expect(evidence.received.filter((x:any)=>x.type==='animation').map((x:any)=>x.state)).to.include.members(['thinking','tool_running','speaking','idle']);});
  });

  it('Given an image and site screenshot, when attached, then both traverse the real WebSocket',()=>{
    connect();
    control('image').selectFile({contents:Cypress.Buffer.from(PNG.split(',')[1],'base64'),fileName:'sample.png',mimeType:'image/png'},{force:true});
    control('transcript').should('contain','[image received]');
    control('input').type('Review this site screenshot');
    control('screenshot').click();
    control('transcript').should('contain','Review this site screenshot [image received]');
    cy.window().then(win=>{const e=(win as any).voiceEvidence;expect(e.sent.find((x:any)=>x.type==='input.image').dataUrl).match(/^data:image\/png;base64,/);expect(e.sent.find((x:any)=>x.type==='input.screenshot').dataUrl).match(/^data:image\/png;base64,/);expect(e.stopped).greaterThan(0);});
  });

  it('Given microphone input, when recording ends, then audio is transcribed and capture tracks stop',()=>{
    connect();control('mic').click().should('have.attr','aria-pressed','true');control('status').should('contain','listening');control('mic').click();
    control('transcript').should('contain','Recorded sandbox voice');
    cy.window().then(win=>{const e=(win as any).voiceEvidence;expect(e.sent.some((x:any)=>x.type==='input.audio'&&x.data)).eq(true);expect(e.stopped).greaterThan(0);});
  });

  it('Given a slow turn, when interrupted and reconnected, then late output cannot revive the old turn',()=>{
    connect();
    el().then(($el)=>{const agent=$el[0] as any;agent.sendText('slow response');});
    control('status').should('contain','tool_running');
    control('interrupt').click();control('status').should('contain','listening');
    control('connect').click();cy.wait('@initialize');control('status').should('contain','ready');send('Fresh connection');
    control('transcript').should('contain','Sandbox voice reply: Fresh connection').and('not.contain','Sandbox voice reply: slow response');
    cy.window().then(win=>expect((win as any).voiceEvidence.sent.some((x:any)=>x.type==='interrupt')).eq(true));
    control('disconnect').click();control('status').should('contain','disconnected');control('send').should('be.disabled');
  });

  it('Given active PCM playback, when interrupted, then native audio stops and no queued speech resumes',()=>{
    connect();send('long audio');control('status').should('contain','speaking');
    control('interrupt').click();control('status').should('contain','listening');
    cy.window().then(win=>expect((win as any).voiceEvidence.playbackStopped).greaterThan(0));
    send('After interruption');control('transcript').should('contain','Sandbox voice reply: After interruption');
  });

  it('Given configurable context actions, when permissions change, then disabled actions disappear and config requires reconnection',()=>{
    connect();el().shadow().find('.panel').rightclick();control('configure-model').click();control('config-model').clear().type('fixture-model-2').blur();
    control('pending').should('contain','Reconnect');control('send').should('be.disabled');control('connect').click();cy.wait('@initialize').its('request.body.model').should('eq','fixture-model-2');control('status').should('contain','ready');
    control('options').click();control('configure-prompt').click();control('config-systemPrompt').clear().type('Be concise.').blur();control('connect').click();cy.wait('@initialize').its('request.body.systemPrompt').should('eq','Be concise.');
    el().then(($el)=>{($el[0] as any).contextActions=['clear-transcript'];});control('options').click();control('configure-model').should('not.exist');control('clear-transcript').should('exist');
    el().then(($el)=>{($el[0] as any).contextActions=[];});control('options').should('not.exist');el().shadow().find('[data-testid="agent-config"]').should('not.exist');
  });

  it('Given avatar groups, custom SVG and reduced motion, then state artwork remains selectable and accessible',()=>{
    control('options').click();control('configure-avatar').click();control('config-avatar').select('nova');
    const robot=()=>el().shadow().find('tobor-robot-avatar');
    robot().shadow().find('[part="image"]').should('have.css','background-image').and('contain','nova/states.png');
    cy.screenshot('voice-agent-desktop-nova');
    robot().then(($robot)=>{($robot[0] as any).reducedMotion='force_static';});robot().should('have.attr','data-motion','static');
    el().then(($el)=>{($el[0] as any).avatar={id:'custom',default:{src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="cyan"/></svg>')}};});
    robot().shadow().find('[part="image"]').should('have.attr','role','img').and('have.css','background-image').and('contain','data:image/svg');
    cy.viewport(375,812);control('input').should('be.visible').and('have.css','resize','both');
    control('input').then(($input)=>{const old=$input[0].getBoundingClientRect().height;$input[0].style.height='180px';expect($input[0].getBoundingClientRect().height).greaterThan(old);});
    cy.screenshot('voice-agent-mobile-custom-avatar');
  });
});
