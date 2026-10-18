/// <reference types="cypress" />
// Isolation lane: the party-card family — tobor-party-card (standalone chrome
// + slots), tobor-agent-card and tobor-user-card. Property-fed, no backend.
const el = (tag: string) => cy.get(tag).shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(tag: string, attrs: Record<string, string> = {}, props: Record<string, unknown> = {}, slotsHTML = '') {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount(tag, attrs, props, slotsHTML);
  });
}

describe('Given the party-card family on the isolation harness, when presence, slots and CTAs are exercised, then chrome, badges and events track the host inputs', () => {
  it('Given tobor-party-card with name, handle and presence, when badges and avatar slots are provided, then the chrome renders and an unknown presence falls back to offline', () => {
    mount('tobor-party-card', {'display-name': 'Ada Byte', handle: '@ada', presence: 'online'}, {}, '<span slot="badges">maintainer</span>');
    el('tobor-party-card').find('[data-cy="party.card"]').should('have.attr', 'data-presence', 'online');
    el('tobor-party-card').find('[data-cy="party.name"]').should('have.text', 'Ada Byte');
    el('tobor-party-card').find('[data-cy="party.handle"]').should('have.text', '@ada');
    el('tobor-party-card').find('.initials').should('have.text', 'AB');
    cy.get('tobor-party-card').find('[slot="badges"]').should('have.text', 'maintainer');
    cy.screenshot('party-card-online-slots');

    mount('tobor-party-card', {'display-name': 'Glitch', presence: 'warp'});
    el('tobor-party-card').find('[data-cy="party.card"]').should('have.attr', 'data-presence', 'offline');
    el('tobor-party-card').find('[data-cy="party.presence"]').should('have.attr', 'title', 'Offline');
    cy.screenshot('party-card-presence-fallback');
  });

  it('Given tobor-agent-card, when Chat is clicked, then agent-chat carries the agentId; capability chips respect show-capabilities and a missing id disables the CTA', () => {
    mount('tobor-agent-card', {'display-name': 'Rook', 'agent-id': 'agent-rook', 'model-badge': 'zai/sonnet'}, {capabilities: ['sockets', 'cypress']});
    el('tobor-agent-card').find('[data-cy="agent.caps"] li').should('have.length', 2).and('contain', 'sockets');
    el('tobor-agent-card').find('.badge--model').should('have.text', 'zai/sonnet');
    cy.screenshot('agent-card-mounted');

    el('tobor-agent-card').find('[data-cy="agent.chat"]').click();
    events().then((evts: any[]) => {
      const chats = evts.filter((e) => e.type === 'agent-chat');
      expect(chats, 'one agent-chat per click').to.have.length(1);
      expect(chats[0].detail).to.deep.eq({agentId: 'agent-rook'});
    });
    cy.screenshot('agent-card-chat-clicked');

    mount('tobor-agent-card', {'display-name': 'Bare', 'show-capabilities': 'false'});
    el('tobor-agent-card').find('[data-cy="agent.caps"]').should('not.exist');
    el('tobor-agent-card').find('[data-cy="agent.chat"]').should('be.disabled');
    cy.screenshot('agent-card-disabled-cta');
  });

  it('Given tobor-user-card, when Profile is clicked, then user-profile carries the userId and role/org badges render', () => {
    mount('tobor-user-card', {'display-name': 'Keith', handle: '@keith', 'user-id': 'u-42', role: 'admin', org: 'noizu'});
    el('tobor-user-card').find('.badge').should('contain', 'admin').and('contain', 'noizu');
    cy.screenshot('user-card-mounted');

    el('tobor-user-card').find('[data-cy="user.profile"]').click();
    events().then((evts: any[]) => {
      const views = evts.filter((e) => e.type === 'user-profile');
      expect(views, 'one user-profile per click').to.have.length(1);
      expect(views[0].detail).to.deep.eq({userId: 'u-42'});
    });
    cy.screenshot('user-card-profile-clicked');

    mount('tobor-user-card', {'display-name': 'Anon'});
    el('tobor-user-card').find('[data-cy="user.profile"]').should('be.disabled');
    cy.screenshot('user-card-disabled-cta');
  });
});
