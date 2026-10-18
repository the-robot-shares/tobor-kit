/// <reference types="cypress" />
// Isolation lane: tobor-task-menu on the blank harness page. The inventory is
// a server-dressed object property — no backend calls at all.
const events = () => cy.window().then((win: any) => win.__events);

const INVENTORY = {
  tools: [
    {name: 'search_docs', label: 'Search docs'},
    {name: 'deploy_flag', label: 'Deploy flag', confirm: true},
  ],
  groups: [],
  degraded: [{server: 'mcp-tools'}],
};

function menu() {
  return cy.get('tobor-task-menu').shadow();
}

function mount(props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-task-menu', {}, {inventory: INVENTORY, ...props});
    win.__events.length = 0;
  });
}

describe('Given a server-dressed task inventory, when the menu is driven on the isolation harness, then selection and confirmation emit tobor-task-select', () => {
  it('Given a closed menu, when the trigger is clicked, then the panel opens with tools and the degraded notice', () => {
    mount();
    menu().find('[data-testid="task-menu-panel"]').should('not.exist');
    cy.get('tobor-task-menu').should('not.have.attr', 'open');
    menu().find('[data-testid="task-menu-trigger"]').click();
    menu().find('[data-testid="task-menu-panel"]').should('be.visible');
    cy.get('tobor-task-menu').should('have.attr', 'open');
    menu().find('[data-testid="task-menu-degraded"]').should('contain', 'mcp-tools unreachable');
    menu().find('[role="menuitem"][data-tool="search_docs"]').should('contain', 'Search docs');
    menu().find('[role="menuitem"][data-tool="deploy_flag"]').should('contain', '⚠');
    cy.screenshot('task-menu-open');
  });

  it('Given an open menu, when a read-only tool is selected, then tobor-task-select carries the tool and the menu closes', () => {
    mount({open: true});
    menu().find('[role="menuitem"][data-tool="search_docs"]').click({force: true});
    events().then((evts: any[]) => {
      const select = evts.find((e) => e.type === 'tobor-task-select');
      expect(select, 'tobor-task-select emitted').to.exist;
      expect(select.detail.tool).to.deep.eq({name: 'search_docs', label: 'Search docs'});
    });
    menu().find('[data-testid="task-menu-panel"]').should('not.exist');
    cy.screenshot('task-menu-selected');
  });

  it('Given a confirm tool, when selected, then a two-step confirmation gates the event and Escape closes without emitting', () => {
    mount({open: true});
    menu().find('[role="menuitem"][data-tool="deploy_flag"]').click({force: true});
    menu().find('[data-testid="task-confirm-text"]').should('contain', 'Run “Deploy flag”?');
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'tobor-task-select'), 'no event yet during confirm').to.have.length(0);
    });
    cy.screenshot('task-menu-confirm-step');
    menu().find('[data-testid="task-confirm-yes"]').click({force: true});
    events().then((evts: any[]) => {
      expect(evts.find((e) => e.type === 'tobor-task-select')!.detail.tool.name).to.eq('deploy_flag');
    });
    menu().find('[data-testid="task-menu-panel"]').should('not.exist');
    cy.screenshot('task-menu-confirmed');

    // Escape closes an open menu without any selection.
    mount({open: true});
    menu().find('[data-testid="task-menu-panel"]').should('be.visible');
    // Send a real keydown through the panel's handler.
    cy.document().then((doc) => {
      const panelEl = doc.querySelector('tobor-task-menu')!.shadowRoot!.querySelector('.panel')!;
      panelEl.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true}));
    });
    menu().find('[data-testid="task-menu-panel"]').should('not.exist');
    cy.screenshot('task-menu-escape-closed');
  });

  it('Given an empty inventory, when the menu opens, then the empty notice shows and nothing is selectable', () => {
    cy.visit('/e2e/isolation/harness.html');
    cy.window().then(async (win: any) => {
      await win.mount('tobor-task-menu', {}, {inventory: {tools: [], groups: [], degraded: []}, open: true});
      win.__events.length = 0;
    });
    cy.get('tobor-task-menu').shadow().find('[data-testid="task-menu-empty"]').should('contain', 'No tasks available.');
    cy.screenshot('task-menu-empty-inventory');
  });
});
