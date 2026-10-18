/// <reference types="cypress" />
// Isolation lane: tobor-guide-panel on the blank harness page. The projection
// and a fake client are passed as properties, so no network is touched — the
// turn stream is simulated by the fake client's streamTurn.
const GUIDE = {
  slug: 'demo-guide',
  name: 'Tobor',
  title: 'Your guide',
  greeting: 'Hello, how can I help?',
  modes: ['text', 'transcript'],
  default_mode: 'text',
  ui: {panel: {show_task_menu: true, show_tool_list: true}},
  auth: {required: false, provider: 'none'},
  telemetry: {},
  voice: {},
  transcript: {},
} as const;

const INVENTORY = {tools: [{name: 'search_docs', label: 'Search docs'}], groups: [], degraded: []};

function fakeClient(turnBehavior?: (h: any) => void) {
  return {
    getGuide: async () => GUIDE,
    listTools: async () => INVENTORY,
    createSession: async () => ({id: 'sess-1', created_at: '', state: 'idle'}),
    streamTurn: async (_sessionId: string, _body: unknown, handlers: any) => {
      if (turnBehavior) turnBehavior(handlers);
      else {
        handlers.onState?.('thinking');
        handlers.onDelta?.('Hello there');
        handlers.onMessage?.({role: 'assistant', text: 'Hello there'});
      }
    },
    getTelemetryConsent: async () => ({enabled: false, source: 'guide', user_overridable: true}),
    setTelemetryConsent: async () => ({consent: {enabled: true, source: 'guide', user_overridable: true}}),
  };
}
const panel = () => cy.get('tobor-guide-panel').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(client: unknown, attrs: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-guide-panel', attrs, {guide: GUIDE, client});
    win.__events.length = 0;
  });
}

describe('Given the guide orchestrator with a projected config, when the panel is driven on the isolation harness, then modes, tasks and turn streaming wire through with real events', () => {
  it('Given a loaded projection, when the panel renders collapsed, then the header, task menu and telemetry footer show; expanding reveals the greeting', () => {
    mount(fakeClient());
    panel().find('h1').should('have.text', 'Tobor');
    panel().find('[data-testid="panel-loading"]').should('not.exist');
    panel().find('[data-testid="greeting"]').should('not.exist');
    panel().find('tobor-task-menu').should('exist');
    panel().find('[data-testid="expand"]').should('contain.text', 'Open');
    cy.screenshot('guide-panel-collapsed');

    panel().find('[data-testid="expand"]').click();
    panel().find('[data-testid="greeting"]').should('have.text', 'Hello, how can I help?');
    panel().find('[data-testid="text-input"]').should('be.visible');
    panel().find('tobor-mode-toggle').should('exist');
    panel().find('[data-testid="collapse"]').should('contain.text', 'Collapse');
    cy.screenshot('guide-panel-expanded');
  });

  it('Given an expanded panel, when a turn is submitted, then tobor-turn-submitted/state-change/turn-message fire in order from the streamed turn', () => {
    mount(fakeClient());
    panel().find('[data-testid="expand"]').click();
    panel().find('[data-testid="text-input"]').type('What can you do?');
    panel().find('[data-testid="send"]').click();

    events().then((evts: any[]) => {
      const submitted = evts.find((e) => e.type === 'tobor-turn-submitted');
      expect(submitted, 'tobor-turn-submitted emitted').to.exist;
      expect(submitted.detail).to.deep.eq({input: 'What can you do?'});
      const state = evts.find((e) => e.type === 'tobor-state-change');
      expect(state!.detail).to.deep.eq({state: 'thinking'});
      const message = evts.find((e) => e.type === 'tobor-turn-message');
      expect(message, 'tobor-turn-message emitted').to.exist;
      expect(message.detail.turn.text).to.eq('Hello there');
      const names = evts.map((e) => e.type);
      expect(names.indexOf('tobor-turn-submitted')).to.be.lessThan(names.indexOf('tobor-turn-message'));
    });
    panel().find('tobor-robot-avatar').shadow().find('[data-testid="state-label"]').should('have.text', 'idle');
    cy.screenshot('guide-panel-turn-complete');
  });

  it('Given a failed stream, when the turn errors, then the turn-error notice shows and tobor-turn-error fires with state error', () => {
    mount(fakeClient((h) => {
      h.onState?.('thinking');
      h.onError?.({code: 'stream_failed', message: 'upstream hung up'});
    }));
    panel().find('[data-testid="expand"]').click();
    panel().find('[data-testid="text-input"]').type('Hi');
    panel().find('[data-testid="send"]').click();

    panel().find('[data-testid="turn-error"]').should('contain', 'upstream hung up');
    events().then((evts: any[]) => {
      const error = evts.find((e) => e.type === 'tobor-turn-error');
      expect(error, 'tobor-turn-error emitted').to.exist;
      expect(error.detail.error.code).to.eq('stream_failed');
      // Error state is set internally (no tobor-state-change for errors) —
      // the avatar face is the observable tell.
      panel().find('tobor-robot-avatar').shadow()
        .find('[part="mouth"]').should('have.attr', 'data-mouth', 'frown');
    });
    cy.screenshot('guide-panel-turn-error');
  });

  it('Given a task selected from the menu, when it is invoked and a turn submitted, then the task id rides along on the submitted turn', () => {
    mount(fakeClient());
    panel().find('[data-testid="expand"]').click();
    panel().find('tobor-task-menu').shadow().find('[data-testid="task-menu-trigger"]').click({force: true});
    panel().find('tobor-task-menu').shadow().find('[role="menuitem"][data-tool="search_docs"]').click({force: true});

    events().then((evts: any[]) => {
      const invoked = evts.find((e) => e.type === 'tobor-task-invoked');
      expect(invoked, 'tobor-task-invoked emitted').to.exist;
      expect(invoked.detail).to.deep.eq({task_id: 'search_docs'});
    });
    // task_id is advisory: it should be attached to the next submitted turn.
    panel().find('[data-testid="text-input"]').type('Find stuff');
    panel().find('[data-testid="send"]').click();
    events().then((evts: any[]) => {
      const submitted = evts.filter((e) => e.type === 'tobor-turn-submitted').at(-1)!;
      expect(submitted.detail).to.deep.eq({input: 'Find stuff', task_id: 'search_docs'});
    });
    cy.screenshot('guide-panel-task-invoked');
  });
});
