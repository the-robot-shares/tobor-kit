/// <reference types="cypress" />
// Isolation lane: tobor-wiki-space + tobor-wiki-entry + tobor-wiki-entry-editor.
// Data enters via `spaces` / `entry` properties; no fetches to mock.
const el = (tag: string) => cy.get(tag).shadow();
const events = () => cy.window().then((win: any) => win.__events);

const SPACES = [
  {id: 's-eng', title: 'Engineering', slug: 'eng'},
  {id: 's-ops', title: 'Operations', slug: 'ops'},
];
const ENTRY = {id: 'w-1', title: 'Runbook', body: '<npl>step one</npl>', spaceId: 's-eng'};

function mount(tag: string, attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount(tag, attrs, props));
}

describe('Given host-supplied wiki data on the isolation harness, when spaces, entry, and editor are driven, then wiki-space-select, wiki-edit, and wiki-save carry host-persistable payloads', () => {
  it('Given a space roster, when a space is clicked, then wiki-space-select emits the id and the row is highlighted', () => {
    mount('tobor-wiki-space', {'selected-id': 's-eng'}, {spaces: SPACES});
    el('tobor-wiki-space').find('[data-cy="wiki.space"]').should('be.visible');
    el('tobor-wiki-space').find('[data-cy="wiki.space-item"]').should('have.length', 2);
    el('tobor-wiki-space').find('[data-cy="wiki.space-item"][data-space-id="s-eng"]').should('have.attr', 'aria-current', 'page');
    cy.screenshot('wiki-space-mounted');

    el('tobor-wiki-space').find('[data-cy="wiki.space-item"][data-space-id="s-ops"]').click();
    el('tobor-wiki-space').find('[data-cy="wiki.space-item"][data-space-id="s-ops"]').should('have.attr', 'aria-current', 'page');
    events().then((evts: any[]) => {
      expect(evts, 'one wiki-space-select').to.have.length(1);
      expect(evts[0].type).to.eq('wiki-space-select');
      expect(evts[0].detail).to.deep.eq({id: 's-ops'});
    });
    cy.screenshot('wiki-space-selected');
  });

  it('Given an entry, when Edit is clicked, then wiki-edit emits the entry id and the source body renders as text', () => {
    mount('tobor-wiki-entry', {}, {entry: ENTRY});
    el('tobor-wiki-entry').find('[data-cy="wiki.entry"]').should('be.visible').and('contain', 'Runbook');
    el('tobor-wiki-entry').find('pre').should('have.text', '<npl>step one</npl>');
    cy.screenshot('wiki-entry-mounted');

    el('tobor-wiki-entry').find('button[part="edit"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one wiki-edit').to.have.length(1);
      expect(evts[0].type).to.eq('wiki-edit');
      expect(evts[0].detail).to.deep.eq({id: 'w-1'});
    });
    cy.screenshot('wiki-entry-edit-started');
  });

  it('Given the editor seeded from an entry, when title and body are edited and saved, then wiki-save emits the draft with the spaceId', () => {
    mount('tobor-wiki-entry-editor', {}, {entry: ENTRY});
    el('tobor-wiki-entry-editor').find('[data-cy="wiki.editor"]').should('be.visible');
    el('tobor-wiki-entry-editor').find('input[name="title"]').should('have.value', 'Runbook');
    el('tobor-wiki-entry-editor').find('textarea[name="body"]').should('have.value', '<npl>step one</npl>');
    cy.screenshot('wiki-editor-mounted');

    el('tobor-wiki-entry-editor').find('input[name="title"]').clear().type('Runbook v2');
    el('tobor-wiki-entry-editor').find('textarea[name="body"]').clear().type('<npl>step two</npl>');
    el('tobor-wiki-entry-editor').find('[data-cy="wiki.save"]').click();

    events().then((evts: any[]) => {
      expect(evts, 'one wiki-save').to.have.length(1);
      expect(evts[0].type).to.eq('wiki-save');
      expect(evts[0].detail).to.deep.eq({id: 'w-1', title: 'Runbook v2', body: '<npl>step two</npl>', spaceId: 's-eng'});
    });
    cy.screenshot('wiki-editor-saved');
  });
});
