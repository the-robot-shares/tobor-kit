/// <reference types="cypress" />
// Isolation lane: tobor-mcp-domain. Tools enter via the `tools` / `inventory`
// properties; tri-state visibility emits tool-visibility-change.
const el = () => cy.get('tobor-mcp-domain').shadow();
const events = () => cy.window().then((win: any) => win.__events);

const TOOLS = [
  {name: 'Github.PullCreate', visibility: 'visible'},
  {name: 'Github.IssueList', visibility: 'discoverable'},
  {name: 'Filesystem.Write', visibility: 'disabled'},
];
const INVENTORY = {
  groups: [
    {id: 'Github', label: 'Github'},
    {id: 'Filesystem', label: 'Filesystem'},
  ],
  tools: [
    {name: 'Github.PullCreate', label: 'Open a PR', group: 'Github', confirm: true},
    {name: 'Github.IssueList', label: 'List issues', group: 'Github', read_only: true},
    {name: 'Filesystem.Write', label: 'Write a file', group: 'Filesystem'},
  ],
};

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount('tobor-mcp-domain', {}, props));
}

describe('Given a per-tool visibility policy on the isolation harness, when tri-state selects are toggled, then tool-visibility-change tracks each transition and the visible preview follows', () => {
  it('Given the tri-state roster, when each state is present, then rows render labeled with their visibility and the preview lists only visible tools', () => {
    mount({tools: TOOLS, inventory: INVENTORY});
    el().find('[data-cy="mcp.domain"]').should('be.visible');
    el().find('[data-cy="mcp.tool"]').should('have.length', 3);
    el().find('[data-cy="mcp.tool"][data-tool="Github.PullCreate"]').should('have.attr', 'data-visibility', 'visible');
    el().find('[data-cy="mcp.tool"][data-tool="Github.IssueList"]').should('have.attr', 'data-visibility', 'discoverable');
    el().find('[data-cy="mcp.tool"][data-tool="Filesystem.Write"]').should('have.attr', 'data-visibility', 'disabled');
    cy.get('tobor-mcp-domain').shadow().find('tobor-tool-list').shadow().find('[data-tool]').should('have.length', 1);
    cy.screenshot('mcp-domain-mounted');
  });

  it('Given a disabled tool, when visibility is cycled disabled→discoverable→visible, then each change emits and the preview grows', () => {
    mount({tools: TOOLS, inventory: INVENTORY});
    const sel = () => el().find('[data-cy="mcp.tool"][data-tool="Filesystem.Write"]').find('select');

    sel().select('discoverable');
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'tool-visibility-change')).to.have.length(1);
      expect(evts[0].detail).to.deep.eq({name: 'Filesystem.Write', visibility: 'discoverable'});
    });
    cy.screenshot('mcp-domain-discoverable');

    sel().select('visible');
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'tool-visibility-change');
      expect(changes).to.have.length(2);
      expect(changes[1].detail).to.deep.eq({name: 'Filesystem.Write', visibility: 'visible'});
    });
    el().find('[data-cy="mcp.tool"][data-tool="Filesystem.Write"]').should('have.attr', 'data-visibility', 'visible');
    cy.get('tobor-mcp-domain').shadow().find('tobor-tool-list').shadow().find('[data-tool]').should('have.length', 2);
    cy.screenshot('mcp-domain-visible');
  });

  it('Given a visible tool, when it is disabled, then it leaves the visible preview', () => {
    mount({tools: TOOLS, inventory: INVENTORY});
    el().find('[data-cy="mcp.tool"][data-tool="Github.PullCreate"]').find('select').select('disabled');
    events().then((evts: any[]) => {
      expect(evts[0].detail).to.deep.eq({name: 'Github.PullCreate', visibility: 'disabled'});
    });
    cy.get('tobor-mcp-domain').shadow().find('tobor-tool-list').shadow().find('[data-tool]').should('have.length', 0);
    cy.screenshot('mcp-domain-drained');
  });
});
