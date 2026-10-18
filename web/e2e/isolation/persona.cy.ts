/// <reference types="cypress" />
// Isolation lane: the persona family — tobor-persona-card (identity chrome +
// Select CTA) and tobor-persona-picker (host-supplied roster, search, select).
// Roster enters via the `personas` property; no fetch, no navigation.
const ROSTER = [
  {id: 'soren', name: 'Soren', handle: '@soren'},
  {id: 'weego', name: 'Weego', handle: '@weego'},
  {id: 'mask', name: 'The Mask'},
];

const cardEl = () => cy.get('tobor-persona-card').shadow();
const pickerEl = () => cy.get('tobor-persona-picker').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(tag: string, attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount(tag, attrs, props);
  });
}

describe('Given the persona family on the isolation harness, when personas are selected and searched, then persona-select carries the id and the roster filters live', () => {
  it('Given tobor-persona-card, when Select is clicked, then persona-select carries the personaId; a missing id disables the CTA', () => {
    mount('tobor-persona-card', {'display-name': 'Soren', handle: '@soren', 'persona-id': 'soren', presence: 'online'});
    cardEl().find('[data-cy="persona.card"]').should('have.attr', 'data-presence', 'online');
    cardEl().find('[data-cy="party.name"]').should('have.text', 'Soren');
    cy.screenshot('persona-card-mounted');

    cardEl().find('button[part="select"]').click();
    events().then((evts: any[]) => {
      const picks = evts.filter((e) => e.type === 'persona-select');
      expect(picks, 'one select per click').to.have.length(1);
      expect(picks[0].detail).to.deep.eq({personaId: 'soren'});
    });
    cy.screenshot('persona-card-selected');

    mount('tobor-persona-card', {'display-name': 'Nobody'});
    cardEl().find('button[part="select"]').should('be.disabled');
    cy.screenshot('persona-card-disabled-cta');
  });

  it('Given a picker roster, when an entry is clicked, then the grid renders names/handles and persona-select carries the clicked id', () => {
    mount('tobor-persona-picker', {}, {personas: ROSTER});
    pickerEl().find('[data-cy="persona.item"]').should('have.length', 3);
    pickerEl().find('[data-persona-id="mask"]').should('contain', 'The Mask');
    pickerEl().find('[data-persona-id="weego"]').should('contain', '@weego');
    cy.screenshot('persona-picker-roster');

    pickerEl().find('[data-persona-id="soren"]').click();
    events().then((evts: any[]) => {
      const picks = evts.filter((e) => e.type === 'persona-select');
      expect(picks, 'one select per click').to.have.length(1);
      expect(picks[0].detail).to.deep.eq({personaId: 'soren'});
    });
    cy.screenshot('persona-picker-selected');
  });

  it('Given the search box, when a query narrows the roster, then matching rows stay, misses vanish and empty states are distinct for no-match vs no-roster', () => {
    mount('tobor-persona-picker', {}, {personas: ROSTER});
    pickerEl().find('[data-cy="persona.search"]').type('wee');
    pickerEl().find('[data-cy="persona.item"]').should('have.length', 1).and('contain', 'Weego');
    // The query also reflects to the host as the `query` property.
    cy.window().then((win: any) => expect((win.document.querySelector('tobor-persona-picker') as any).query).to.eq('wee'));
    cy.screenshot('persona-picker-filtered');

    pickerEl().find('[data-cy="persona.search"]').clear().type('zzz');
    pickerEl().find('.empty').should('contain', 'No matching personas');
    pickerEl().find('[data-cy="persona.item"]').should('have.length', 0);
    cy.screenshot('persona-picker-no-match');

    mount('tobor-persona-picker');
    pickerEl().find('.empty').should('contain', 'No personas');
    cy.screenshot('persona-picker-empty-roster');
  });
});
