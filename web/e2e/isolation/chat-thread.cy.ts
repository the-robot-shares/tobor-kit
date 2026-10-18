/// <reference types="cypress" />
// Isolation lane: tobor-chat-thread fed via the messages/participants/pending
// property API (streaming arrives as pending chunks; no network). The inner
// transcript view lives in a nested shadow root.
const MESSAGES = [
  {id: 'm1', role: 'user', text: 'Roll back staging?', at: '2026-09-07T10:00:00Z', participant: 'p-keith'},
  {id: 'm2', role: 'assistant', text: 'Rolling back now.', at: '2026-09-07T10:00:20Z', participant: 'p-rook'},
];
const PARTICIPANTS = [
  {id: 'p-keith', name: 'Keith'},
  {id: 'p-rook', name: 'Rook'},
];

const el = () => cy.get('tobor-chat-thread').shadow();
const inner = () => el().find('tobor-transcript-view').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount('tobor-chat-thread', {}, props);
  });
}

describe('Given a chat thread on the isolation harness, when messages, streaming chunks and the composer interact, then the roster, log and thread-send events track the conversation', () => {
  it('Given messages with participants, when the thread renders, then the roster chips show and participant names plus UTC stamps are baked into each turn', () => {
    mount({messages: MESSAGES, participants: PARTICIPANTS, pending: 'Fetching job status…'});
    el().find('.participant').should('have.length', 2).and('contain', 'Rook');
    inner().find('.turn[data-turn-id="m1"]').should('contain', 'Keith').and('contain', '2026-09-07 10:00 UTC').and('contain', 'Roll back staging?');
    inner().find('.turn[data-role="assistant"]').first().should('contain', '2026-09-07 10:00 UTC · Rook').and('contain', 'Rolling back now.');
    inner().find('[data-testid="pending-turn"]').should('contain', 'Fetching job status…');
    // No store → no clear affordance; no composer unless asked.
    inner().find('[data-testid="transcript-clear"]').should('not.exist');
    el().find('[data-cy="thread.composer"]').should('not.exist');
    cy.screenshot('chat-thread-roster-and-log');
  });

  it('Given the composer, when Enter or Send submits the draft, then thread-send carries the trimmed text and the draft resets; empty drafts send nothing', () => {
    mount({messages: MESSAGES, participants: PARTICIPANTS, showComposer: true});
    const composer = () => el().find('[data-cy="thread.composer"]');

    composer().type('   ship it   ').type('{enter}');
    events().then((evts: any[]) => {
      const sends = evts.filter((e) => e.type === 'thread-send');
      expect(sends, 'Enter sends once').to.have.length(1);
      expect(sends[0].detail).to.deep.eq({text: 'ship it'});
    });
    composer().should('have.value', '');
    cy.screenshot('chat-thread-enter-sent');

    composer().type('via button').then(() => {
      el().find('[data-cy="thread.send"]').click();
    });
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'thread-send').at(-1).detail).to.deep.eq({text: 'via button'}));

    composer().type('   ').type('{enter}');
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'thread-send'), 'whitespace draft sends nothing').to.have.length(2));
    cy.screenshot('chat-thread-button-sent');
  });

  it('Given a store, when Clear transcript is clicked, then the thread resets and the inner log falls back to the empty state', () => {
    mount({
      messages: MESSAGES,
      store: {
        kind: 'memory',
        writable: true,
        load: async () => ({status: 'ok', turns: [], has_more: false}),
        append: async () => {},
        clear: async () => {},
      },
    });
    inner().find('[data-testid="transcript-clear"]').should('be.visible').click();
    inner().find('[data-testid="transcript-empty"]').should('contain', 'Nothing said yet.');
    el().find('[data-cy="thread.composer"]').should('not.exist');
    cy.screenshot('chat-thread-cleared');
  });
});
