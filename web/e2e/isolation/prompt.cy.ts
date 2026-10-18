/// <reference types="cypress" />
// Isolation lane: tobor-prompt-library + tobor-prompt-history. Data enters via
// the `prompts` / `entries` properties; no fetches to mock.
const el = (tag: string) => cy.get(tag).shadow();
const events = () => cy.window().then((win: any) => win.__events);

const PROMPTS = [
  {id: 'p-1', title: 'Summarize', body: 'Summarize the doc', starred: true},
  {id: 'p-2', title: 'Translate', body: 'Translate to French'},
];
const HISTORY = [
  {id: 'h-1', title: 'Summarize', at: '2026-09-01T10:00:00Z', version: 2, starred: false},
  {id: 'h-2', title: 'Translate', at: '2026-09-02T11:00:00Z', starred: true},
];

function mount(tag: string, attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount(tag, attrs, props));
}

describe('Given host-supplied prompt data on the isolation harness, when the library and history are driven, then prompt-select, prompt-star, and prompt-fork carry host-persistable payloads', () => {
  it('Given a roster, when a prompt is selected, then prompt-select emits the id and the row is highlighted', () => {
    mount('tobor-prompt-library', {'selected-id': 'p-1'}, {prompts: PROMPTS});
    el('tobor-prompt-library').find('[data-cy="prompt.library"]').should('be.visible');
    el('tobor-prompt-library').find('[data-cy="prompt.item"]').should('have.length', 2);
    cy.screenshot('prompt-library-mounted');

    el('tobor-prompt-library').find('[data-cy="prompt.item"][data-prompt-id="p-2"]').click();
    el('tobor-prompt-library').find('[data-cy="prompt.item"][data-prompt-id="p-2"]').should('have.attr', 'aria-current', 'true');
    events().then((evts: any[]) => {
      expect(evts, 'one prompt-select').to.have.length(1);
      expect(evts[0].type).to.eq('prompt-select');
      expect(evts[0].detail).to.deep.eq({id: 'p-2'});
    });
    cy.screenshot('prompt-library-selected');
  });

  it('Given a starred prompt, when it is unstarred and another starred, then prompt-star emits the toggled state', () => {
    mount('tobor-prompt-library', {}, {prompts: PROMPTS});
    el('tobor-prompt-library').find('[data-cy="prompt.star"][data-prompt-id="p-1"]').should('have.attr', 'aria-pressed', 'true').click();
    events().then((evts: any[]) => {
      expect(evts[0].type).to.eq('prompt-star');
      expect(evts[0].detail).to.deep.eq({id: 'p-1', starred: false});
    });
    el('tobor-prompt-library').find('[data-cy="prompt.star"][data-prompt-id="p-2"]').click();
    events().then((evts: any[]) => {
      const stars = evts.filter((e) => e.type === 'prompt-star');
      expect(stars).to.have.length(2);
      expect(stars[1].detail).to.deep.eq({id: 'p-2', starred: true});
    });
    cy.screenshot('prompt-library-starred');
  });

  it('Given the query attribute, when the search field filters, then only matching prompts remain', () => {
    mount('tobor-prompt-library', {query: 'trans'}, {prompts: PROMPTS});
    el('tobor-prompt-library').find('[data-cy="prompt.item"]').should('have.length', 1);
    el('tobor-prompt-library').find('[data-cy="prompt.item"]').should('have.attr', 'data-prompt-id', 'p-2');
    cy.screenshot('prompt-library-filtered');
  });

  it('Given a revision history, when Fork and Star are driven, then prompt-fork and prompt-star emit the row id', () => {
    mount('tobor-prompt-history', {}, {entries: HISTORY});
    el('tobor-prompt-history').find('[data-cy="prompt.history"]').should('be.visible');
    el('tobor-prompt-history').find('[data-cy="prompt.fork"]').should('have.length', 2);
    cy.screenshot('prompt-history-mounted');

    el('tobor-prompt-history').find('[data-cy="prompt.fork"][data-prompt-id="h-1"]').click();
    el('tobor-prompt-history').find('[data-cy="prompt.star"][data-prompt-id="h-1"]').click();
    events().then((evts: any[]) => {
      expect(evts.map((e) => e.type)).to.deep.eq(['prompt-fork', 'prompt-star']);
      expect(evts[0].detail).to.deep.eq({id: 'h-1'});
      expect(evts[1].detail).to.deep.eq({id: 'h-1', starred: true});
    });
    cy.screenshot('prompt-history-forked-starred');
  });

  it('Given a diff via property, when rendered, then both panes show their labeled source text', () => {
    mount('tobor-prompt-history', {}, {
      entries: HISTORY,
      diff: {left: {label: 'v1', body: 'old text'}, right: {label: 'v2', body: 'new text'}},
    });
    el('tobor-prompt-history').find('[part="diff"]').should('contain', 'old text').and('contain', 'new text');
    cy.screenshot('prompt-history-diff');
  });
});
