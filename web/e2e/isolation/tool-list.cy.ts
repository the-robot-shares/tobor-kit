/// <reference types="cypress" />
// Isolation lane: tobor-tool-list fed the server-dressed inventory via the
// `inventory` property — no fetch; the element renders the response verbatim.
const INVENTORY = {
  groups: [
    {id: 'search', label: 'Search'},
    {id: 'write', label: 'Write tools'},
  ],
  tools: [
    {name: 'wiki_lookup', label: 'Wiki Lookup', group: 'search', description: 'Search the project wiki.', read_only: true, confirm: false},
    {name: 'deploy_kick', label: 'Kick Deploy', group: 'write', description: 'Trigger a deploy.', read_only: false, confirm: true},
  ],
  degraded: [] as Array<{server?: string; error?: string}>,
};

const el = () => cy.get('tobor-tool-list').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount(inventory: unknown) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount('tobor-tool-list', {}, {inventory});
  });
}

describe('Given a server-dressed tool inventory on the isolation harness, when tools are rendered or clicked, then the list mirrors the response and tobor-tool-select carries the tool', () => {
  it('Given a grouped inventory, when a tool is clicked, then the group headers, badges and descriptions render and tobor-tool-select emits the full tool', () => {
    mount(INVENTORY);
    el().find('section[data-group="search"]').should('contain', 'Search').find('button[data-tool="wiki_lookup"]').should('contain', 'read-only');
    el().find('button[data-tool="deploy_kick"]').should('contain', 'confirm').and('contain', 'Trigger a deploy.');
    cy.screenshot('tool-list-rendered');

    el().find('button[data-tool="wiki_lookup"]').click();
    events().then((evts: any[]) => {
      const picks = evts.filter((e) => e.type === 'tobor-tool-select');
      expect(picks, 'one select per click').to.have.length(1);
      expect(picks[0].detail.tool).to.deep.eq(INVENTORY.tools[0]);
    });
    cy.screenshot('tool-list-selected');
  });

  it('Given degraded servers in the inventory, when the list renders, then the degraded notice names each unreachable server — including unidentified ones', () => {
    mount({
      ...INVENTORY,
      degraded: [{server: 'mcp-mail', error: 'connection refused'}, {error: 'timeout'}],
    });
    el().find('[data-testid="degraded-servers"]').should('contain', 'Some tool servers are unreachable');
    el().find('[data-testid="degraded-servers"] li[data-server="mcp-mail"]').should('contain', 'mcp-mail — connection refused');
    el().find('[data-testid="degraded-unidentified"]').should('contain', 'A tool server is unreachable');
    cy.screenshot('tool-list-degraded');
  });

  it('Given no inventory or an empty one, when the element renders, then the honest empty states show', () => {
    mount(null);
    el().find('[data-testid="tools-unavailable"]').should('contain', 'Tools unavailable.');
    mount({...INVENTORY, tools: []});
    el().find('[data-testid="tools-empty"]').should('contain', 'No tools are exposed for this guide.');
    cy.screenshot('tool-list-empty-states');
  });
});
