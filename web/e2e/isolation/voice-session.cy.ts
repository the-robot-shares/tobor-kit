/// <reference types="cypress" />
// Isolation lane: tobor-voice-session on the blank harness page.
// The adapter is replaced via the element's documented adapterFactory test
// seam, so no mic, gateway or provider is ever touched.
const el = () => cy.get('tobor-voice-session');
const mic = () => el().shadow().find('[data-testid="voice-mic"]');
const status = () => el().shadow().find('[data-testid="voice-status"]');

function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/voice-session/voice-session.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(props: Record<string, unknown> = {}, attrs: Record<string, string> = {}) {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('tobor-voice-session');
    win.unmount();
    win.__events.length = 0;
    win.__adapterArgs = null;
    win.__stopped = 0;
    win.__sentText = null;
    const host = win.document.createElement('tobor-voice-session');
    const native = host.dispatchEvent.bind(host);
    host.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    for (const [name, value] of Object.entries(attrs)) host.setAttribute(name, value);
    host.client = {kind: 'fake-client'};
    host.voice = {adapter: 'fake', pushToTalk: false};
    host.adapterFactory = (args: any) => {
      win.__adapterArgs = {hasClient: Boolean(args.client), hasAudioHost: Boolean(args.audioHost), adapter: args.voice?.adapter};
      return {
        active: true,
        start: async () => {
          args.hooks.onState('thinking');
          args.hooks.onState('listening');
          args.hooks.onTranscript({role: 'user', text: 'heard you', final: true});
        },
        stop: async () => {
          win.__stopped += 1;
        },
        sendText: (text: string) => {
          win.__sentText = text;
        },
      };
    };
    for (const [name, value] of Object.entries(props)) host[name] = value;
    win.document.getElementById('mount-root').appendChild(host);
    return host;
  });
}

const events = () => cy.window().then((win: any) => win.__events);

describe('Given a fake voice adapter, when driving tobor-voice-session on the isolation harness, then mic interactions translate to canonical states and events', () => {
  it('Given an idle session, when the mic is clicked, then the adapter starts, states stream and the transcript event fires', () => {
    visit();
    mount();
    mic().should('have.attr', 'aria-pressed', 'false');
    status().should('contain.text', 'Voice off');
    mic().click();
    status().should('have.attr', 'data-state', 'listening').and('contain.text', 'Listening');
    mic().should('have.attr', 'aria-pressed', 'true');
    cy.window().then((win: any) => {
      expect(win.__adapterArgs).to.deep.eq({hasClient: true, hasAudioHost: true, adapter: 'fake'});
    });
    events().then((evts: any[]) => {
      const states = evts.filter((e) => e.type === 'tobor-voice-state').map((e) => e.detail.state);
      expect(states).to.deep.eq(['thinking', 'listening']);
      const transcript = evts.filter((e) => e.type === 'tobor-voice-transcript');
      expect(transcript.length, 'tobor-voice-transcript emitted').to.eq(1);
      expect(transcript[0].detail.entry).to.deep.eq({role: 'user', text: 'heard you', final: true});
    });
    cy.screenshot('voice-session-active');
  });

  it('Given an active session, when the mic is clicked again, then the adapter stops and the status resets', () => {
    visit();
    mount();
    mic().click();
    status().should('contain.text', 'Listening');
    mic().click();
    status().should('have.attr', 'data-state', 'idle').and('contain.text', 'Voice off');
    mic().should('have.attr', 'aria-pressed', 'false');
    cy.window().then((win: any) => expect(win.__stopped, 'adapter stopped once').to.eq(1));
    cy.screenshot('voice-session-stopped');
  });

  it('Given push-to-talk mode, when the mic is held and released, then the session starts on press and stops on release', () => {
    visit();
    mount({}, {'push-to-talk': ''});
    mic().trigger('pointerdown');
    status().should('contain.text', 'Listening');
    mic().should('have.attr', 'aria-pressed', 'true');
    mic().trigger('pointerup');
    status().should('contain.text', 'Voice off');
    cy.window().then((win: any) => expect(win.__stopped, 'adapter stopped on release').to.eq(1));
    cy.screenshot('voice-session-push-to-talk');
  });

  it('Given an active session, when sendText is called, then the typed text is forwarded through the adapter channel', () => {
    visit();
    mount();
    mic().click();
    status().should('contain.text', 'Listening');
    el().then(($el) => ($el[0] as any).sendText('hello through voice'));
    cy.window().then((win: any) => expect(win.__sentText).to.eq('hello through voice'));
    cy.screenshot('voice-session-send-text');
  });
});
