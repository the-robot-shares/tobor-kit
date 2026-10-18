/// <reference types="cypress" />
// Isolation lane: tobor-mcp-clients. The roster enters via the `clients`
// property; authorize/revoke emit client-authorize / client-revoke.
const el = () => cy.get('tobor-mcp-clients').shadow();
const events = () => cy.window().then((win: any) => win.__events);

const CLIENTS = [
  {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
  {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
];

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount('tobor-mcp-clients', {}, props));
}

describe('Given an MCP client roster on the isolation harness, when authorize and revoke are driven, then client-authorize and client-revoke carry the client id', () => {
  it('Given mixed auth types, when rendered, then each row shows its status and auth kind', () => {
    mount({clients: CLIENTS});
    el().find('[data-cy="mcp.clients"]').should('be.visible');
    el().find('li[data-client-id="github"]').should('have.attr', 'data-auth', 'oauth').and('contain', 'OAuth');
    el().find('li[data-client-id="search"]').should('have.attr', 'data-auth', 'api-key').and('contain', 'API key');
    el().find('li[data-client-id="github"]').find('[part="status"]').should('have.attr', 'data-kind', 'disconnected');
    el().find('li[data-client-id="search"]').find('[part="status"]').should('have.attr', 'data-kind', 'connected');
    cy.screenshot('mcp-clients-mounted');
  });

  it('Given a disconnected oauth client, when Authorize is clicked, then client-authorize emits that client id', () => {
    mount({clients: CLIENTS});
    el().find('[data-cy="mcp.authorize"][data-client-id="github"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one client-authorize').to.have.length(1);
      expect(evts[0].type).to.eq('client-authorize');
      expect(evts[0].detail).to.deep.eq({id: 'github'});
    });
    cy.screenshot('mcp-clients-authorized');
  });

  it('Given a connected api-key client, when Revoke is clicked, then client-revoke emits that client id', () => {
    mount({clients: CLIENTS});
    el().find('[data-cy="mcp.revoke"][data-client-id="search"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one client-revoke').to.have.length(1);
      expect(evts[0].type).to.eq('client-revoke');
      expect(evts[0].detail).to.deep.eq({id: 'search'});
    });
    cy.screenshot('mcp-clients-revoked');
  });
});
