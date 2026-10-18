/// <reference types="cypress" />
// Isolation lane: tobor-voice-agent on the blank harness page.
// The gateway POST is cy.intercept-mocked and the WebSocket is a browser-level
// fake (same techniques as e2e/voice-agent.cy.ts); engine=tts exercises the
// plain-socket path so no realtime/WebRTC credential is needed.
const el = () => cy.get('tobor-voice-agent');
const control = (id: string) => el().shadow().find(`[data-testid="agent-${id}"]`);

function visit() {
  cy.intercept('POST', '/gw/voice/sessions', {
    statusCode: 200,
    body: {sessionId: 'session-1', websocketUrl: 'wss://fake.example/stream'},
  }).as('initialize');
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/voice-agent/voice-agent.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
      const state = {sent: [] as any[], stopped: 0};
      (win as any).__voice = state;
      class FakeSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        static instances: any[] = [];
        readyState = 0;
        sent: any[] = [];
        onmessage?: (event: {data: string}) => void;
        onerror?: () => void;
        onclose?: () => void;
        constructor(public url: string) {
          FakeSocket.instances.push(this);
          setTimeout(() => {
            this.readyState = 1;
          }, 0);
        }
        send(data: string) {
          const parsed = JSON.parse(data);
          this.sent.push(parsed);
          state.sent.push(parsed);
        }
        close() {
          this.readyState = 3;
          this.onclose?.();
        }
      }
      win.WebSocket = FakeSocket;
      const media = () => {
        const canvas = win.document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#00aabb';
        ctx.fillRect(0, 0, 64, 64);
        const stream = canvas.captureStream(5);
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          const stop = track.stop.bind(track);
          track.stop = () => {
            state.stopped++;
            stop();
          };
        });
        return stream;
      };
      Object.defineProperty(win.navigator.mediaDevices, 'getUserMedia', {configurable: true, value: async () => media()});
      class Recorder {
        state = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable?: (event: {data: Blob}) => void;
        onstop?: () => void;
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          this.ondataavailable?.({data: new win.Blob(['fixture voice'], {type: this.mimeType})});
          this.onstop?.();
        }
      }
      win.MediaRecorder = Recorder;
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function serve(win: any) {
  const sock = win.WebSocket.instances.at(-1);
  return new Promise<void>((resolve) => {
    const tick = () => {
      if (sock && sock.readyState === 1) {
        sock.onmessage?.({data: JSON.stringify({type: 'ready', sessionId: 'session-1'})});
        resolve();
      } else {
        setTimeout(tick, 10);
      }
    };
    tick();
  });
}

function connect() {
  control('connect').click();
  cy.window().then(serve);
  cy.wait('@initialize').its('response.statusCode').should('eq', 200);
  control('status').should('contain', 'ready');
}

const events = () => cy.window().then((win: any) => win.__events);

function mount() {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('tobor-voice-agent');
    win.unmount();
    win.__events.length = 0;
    const host = win.document.createElement('tobor-voice-agent');
    const native = host.dispatchEvent.bind(host);
    host.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    host.setAttribute('engine', 'tts');
    host.setAttribute('backend-url', '/gw');
    host.setAttribute('model', 'fixture-model');
    host.setAttribute('organization', 'noizu-labs');
    host.setAttribute('project', 'noizu-infra');
    win.document.getElementById('mount-root').appendChild(host);
    return host;
  });
}

describe('Given a fake voice gateway, when driving tobor-voice-agent on the isolation harness, then the session lifecycle and transcript behave end to end', () => {
  it('Given a gateway session, when Connect is clicked, then the agent reaches ready and emits tobor-agent-ready with state transitions', () => {
    visit();
    mount();
    connect();
    events().then((evts: any[]) => {
      const ready = evts.filter((e) => e.type === 'tobor-agent-ready');
      expect(ready.length, 'tobor-agent-ready emitted').to.eq(1);
      expect(ready[0].detail).to.deep.eq({sessionId: 'session-1'});
      const states = evts.filter((e) => e.type === 'tobor-agent-state').map((e) => e.detail.state);
      expect(states, 'starts thinking while connecting').to.include('thinking');
      expect(states).to.include('idle');
    });
    control('status').should('contain', 'ready · idle');
    cy.screenshot('voice-agent-isolation-ready');
  });

  it('Given a ready session, when a text turn is sent, then input.text traverses the socket and the assistant reply lands in the transcript', () => {
    visit();
    mount();
    connect();
    control('input').type('Hello isolation');
    control('send').click();
    cy.window().then((win: any) => {
      const sock = win.WebSocket.instances.at(-1);
      sock.onmessage?.({data: JSON.stringify({type: 'text', role: 'assistant', turnId: 't1', text: 'Sandbox reply: Hello isolation', final: true})});
    });
    control('transcript').should('contain', 'Sandbox reply: Hello isolation');
    events().then((evts: any[]) => {
      const transcripts = evts.filter((e) => e.type === 'tobor-agent-transcript');
      expect(transcripts.length, 'tobor-agent-transcript emitted for the reply').to.eq(1);
      const reply = transcripts.at(-1).detail.entry;
      expect(reply).to.include({role: 'assistant', text: 'Sandbox reply: Hello isolation', final: true});
    });
    cy.window().then((win: any) => {
      const sock = win.WebSocket.instances.at(-1);
      expect(sock.sent).to.deep.include({type: 'input.text', text: 'Hello isolation'});
    });
    cy.screenshot('voice-agent-isolation-text-turn');
  });

  it('Given a ready session, when the microphone is toggled, then getUserMedia feeds the recorder and stopping submits input.audio', () => {
    visit();
    mount();
    connect();
    control('mic').click().should('have.attr', 'aria-pressed', 'true');
    control('status').should('contain', 'listening');
    events().then((evts: any[]) => {
      const states = evts.filter((e) => e.type === 'tobor-agent-state').map((e) => e.detail.state);
      expect(states).to.include('listening');
    });
    cy.screenshot('voice-agent-isolation-listening');
    control('mic').click();
    cy.window().then((win: any) => {
      const sock = win.WebSocket.instances.at(-1);
      sock.onmessage?.({data: JSON.stringify({type: 'text', role: 'assistant', turnId: 't2', text: 'Recorded fixture voice', final: true})});
    });
    control('transcript').should('contain', 'Recorded fixture voice');
    cy.window({timeout: 10000}).should((win: any) => {
      const audio = win.__voice.sent.find((m: any) => m.type === 'input.audio');
      expect(audio, 'input.audio submitted').to.exist;
      expect(audio.mimeType).to.eq('audio/webm');
      expect(audio.data).to.be.a('string').and.not.eq('');
    });
    cy.window().then((win: any) => {
      expect(win.__voice.stopped, 'capture tracks stopped').to.be.greaterThan(0);
    });
    cy.screenshot('voice-agent-isolation-audio-submitted');
  });

  it('Given a failing gateway, when Connect is clicked, then the agent reports tobor-agent-error and lands in the error state', () => {
    visit();
    // Register after visit() so this intercept wins over the success route.
    cy.intercept('POST', '/gw/voice/sessions', {statusCode: 503, body: {error: 'down'}}).as('initialize-fail');
    mount();
    control('connect').click();
    cy.wait('@initialize-fail');
    el().shadow().find('p.error').should('contain', 'Session initialization failed (503)');
    control('status').should('contain', 'error');
    events().then((evts: any[]) => {
      const errors = evts.filter((e) => e.type === 'tobor-agent-error');
      expect(errors.length, 'tobor-agent-error emitted').to.eq(1);
      expect(errors[0].detail).to.deep.eq({message: 'Session initialization failed (503)'});
      const states = evts.filter((e) => e.type === 'tobor-agent-state').map((e) => e.detail.state);
      expect(states).to.include('error');
    });
    cy.screenshot('voice-agent-isolation-gateway-error');
  });
});
