/// <reference types="cypress" />
// Isolation lane: tobor-mcp-config. Server params enter via url/transport
// attrs + the `extras` property; saving emits config-change.
const el = () => cy.get('tobor-mcp-config').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount('tobor-mcp-config', attrs, props));
}

describe('Given MCP server params on the isolation harness, when transport and URL are edited and saved, then config-change carries the full server config', () => {
  it('Given http defaults, when a URL is typed and saved, then config-change emits {url, transport}', () => {
    mount({}, {});
    el().find('[data-cy="mcp.config"]').should('be.visible');
    el().find('select[name="transport"]').should('have.value', 'http');
    cy.screenshot('mcp-config-mounted');

    el().find('input[name="url"]').type('https://mcp.example.test/mcp');
    el().find('[data-cy="mcp.save"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one config-change').to.have.length(1);
      expect(evts[0].type).to.eq('config-change');
      expect(evts[0].detail).to.deep.eq({url: 'https://mcp.example.test/mcp', transport: 'http'});
    });
    cy.screenshot('mcp-config-saved-http');
  });

  it('Given stdio transport, when the command is set and saved, then config-change emits transport=stdio and the placeholder flips to a command path', () => {
    mount({transport: 'stdio'}, {});
    el().find('select[name="transport"]').should('have.value', 'stdio');
    el().find('input[name="url"]').should('have.attr', 'placeholder', '/usr/local/bin/mcp-server');

    el().find('input[name="url"]').type('/usr/local/bin/mcp-server');
    el().find('[data-cy="mcp.save"]').click();
    events().then((evts: any[]) => {
      expect(evts[0].detail).to.deep.eq({url: '/usr/local/bin/mcp-server', transport: 'stdio'});
    });
    cy.screenshot('mcp-config-saved-stdio');
  });

  it('Given non-secret extras via property, when saved, then config-change includes the extras object', () => {
    mount({url: 'https://mcp.example.test/mcp', transport: 'sse'}, {extras: {timeoutMs: 5000}});
    el().find('[data-cy="mcp.save"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one config-change').to.have.length(1);
      expect(evts[0].detail).to.deep.eq({url: 'https://mcp.example.test/mcp', transport: 'sse', extras: {timeoutMs: 5000}});
    });
    cy.screenshot('mcp-config-saved-extras');
  });
});
