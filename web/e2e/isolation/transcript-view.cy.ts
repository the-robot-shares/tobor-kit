/// <reference types="cypress" />
// Isolation lane: tobor-transcript-view fed via the property API (turns /
// pending / load / store). Streaming arrives as `pending` chunks; clearing
// goes through a duck-typed memory store — no network at all.
const TURNS = [
  {id: 't1', role: 'system', content: 'Guide connected', created_at: ''},
  {id: 't2', role: 'user', content: 'What changed overnight?', created_at: ''},
  {
    id: 't3',
    role: 'assistant',
    content: 'Three checks failed.',
    created_at: '',
    tool_calls: [{name: 'ci_status', ok: true, summary: '2 green, 1 red'}, {name: 'logs_tail', ok: false}],
  },
];

const el = () => cy.get('tobor-transcript-view').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount('tobor-transcript-view', {}, props);
  });
}

describe('Given the transcript island on the isolation harness, when turns stream and clear, then the log, the streaming tail and the three distinct states render honestly', () => {
  it('Given turns and a pending streaming chunk, when they render, then roles and tool calls show and the pending tail appends after the last turn', () => {
    mount({turns: TURNS, pending: 'Checking the fourth job…'});
    el().find('[role="log"]').should('be.visible');
    el().find('.turn[data-role="user"]').should('contain', 'What changed overnight?');
    el().find('.turn[data-role="system"]').should('contain', 'Guide connected');
    el().find('[data-testid="turn-tools"]').should('contain', '✓ ci_status — 2 green, 1 red').and('contain', '✗ logs_tail');
    el().find('[data-testid="pending-turn"]').should('contain', 'Checking the fourth job…');
    cy.screenshot('transcript-turns-and-pending');

    // A later finalized chunk replaces the pending tail with a real turn.
    cy.window().then((win: any) => {
      const view = win.document.querySelector('tobor-transcript-view') as any;
      view.pending = '';
      view.turns = [...view.turns, {id: 't4', role: 'assistant', content: 'Fourth job recovered.', created_at: ''}];
    });
    el().find('[data-testid="pending-turn"]').should('not.exist');
    el().find('.turn[data-turn-id="t4"]').should('contain', 'Fourth job recovered.');
    cy.screenshot('transcript-chunk-finalized');
  });

  it('Given nothing said yet versus a not-server-backed store, when the element renders, then the empty and not-backed states stay visually distinct', () => {
    mount({turns: []});
    el().find('[data-testid="transcript-empty"]').should('contain', 'Nothing said yet.');
    cy.screenshot('transcript-empty');

    mount({turns: [], load: {status: 'not_server_backed'}});
    el().find('[data-testid="not-server-backed"]').should('contain', 'the server stores no copy');
    el().find('[data-testid="transcript-empty"]').should('not.exist');
    cy.screenshot('transcript-not-server-backed');
  });

  it('Given a memory store, when Clear transcript is clicked, then the store clears, tobor-transcript-clear emits and the log falls back to the empty state', () => {
    let cleared = 0;
    mount({
      turns: TURNS,
      store: {
        kind: 'memory',
        writable: true,
        load: async () => ({status: 'ok', turns: [], has_more: false}),
        append: async () => {},
        clear: async () => {
          cleared += 1;
        },
      },
    });
    el().find('[data-testid="transcript-clear"]').should('be.visible').click();
    events().then((evts: any[]) => {
      expect(cleared, 'store.clear ran').to.eq(1);
      const clears = evts.filter((e) => e.type === 'tobor-transcript-clear');
      expect(clears, 'one clear event').to.have.length(1);
      expect(clears[0].detail).to.deep.eq({});
    });
    el().find('[data-testid="transcript-empty"]').should('contain', 'Nothing said yet.');
    cy.screenshot('transcript-cleared');
  });
});
