/// <reference types="cypress" />
// Isolation lane: the noizu-sg-* styleguide family (7 tags) on the blank
// harness page. Pure presentational islands — no backend anywhere.
const STYLEGUIDE_MODULES = [
  'noizu-sg-btn',
  'noizu-sg-card',
  'noizu-sg-card-grid',
  'noizu-sg-status',
  'noizu-sg-input',
  'noizu-sg-spec-table',
  'noizu-sg-steps',
]
  .map((name) => `import '/dist/components/styleguide/${name}.js';`)
  .join('');

function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent = `${STYLEGUIDE_MODULES}window.__modulesReady = true;`;
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(tag: string, attrs: Record<string, unknown> = {}, slotsHTML = '') {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined(tag);
    win.unmount();
    win.__events.length = 0;
    const host = win.document.createElement(tag);
    const native = host.dispatchEvent.bind(host);
    host.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    for (const [name, value] of Object.entries(attrs)) {
      if (typeof value === 'boolean') {
        if (value) host.setAttribute(name, '');
      } else {
        host.setAttribute(name, String(value));
      }
    }
    const tpl = win.document.createElement('template');
    tpl.innerHTML = slotsHTML;
    while (tpl.content.firstChild) host.appendChild(tpl.content.firstChild);
    win.document.getElementById('mount-root').appendChild(host);
    return host;
  });
}

const events = () => cy.window().then((win: any) => win.__events);

describe('Given the styleguide family, when each island is mounted on the isolation harness, then variants render and the interactive tags emit their events', () => {
  it('Given sg-btn variants, when rendered and clicked, then variants apply, disabled blocks clicks and sg-click fires for the enabled button', () => {
    visit();
    mount('noizu-sg-btn', {variant: 'danger', size: 'lg'}, 'Delete project');
    cy.get('noizu-sg-btn').shadow().find('[data-cy="sg.btn"]').should('have.attr', 'data-variant', 'danger');
    cy.get('noizu-sg-btn').shadow().find('[data-cy="sg.btn"]').click({force: true});
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'sg-click'), 'enabled click emits sg-click').to.have.length(1);
    });
    cy.screenshot('styleguide-btn-danger-clicked');
    visit();
    mount('noizu-sg-btn', {variant: 'primary', disabled: true}, 'Disabled');
    cy.get('noizu-sg-btn').shadow().find('[data-cy="sg.btn"]').should('be.disabled').and('have.attr', 'data-variant', 'primary');
    cy.get('noizu-sg-btn').shadow().find('[data-cy="sg.btn"]').then(($b: any) => $b[0].click());
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'sg-click')).to.have.length(0));
    cy.screenshot('styleguide-btn-disabled');
  });

  it('Given an sg-card with slots, when clicked, then sg-card-select carries the href and header/body/footer project into their parts', () => {
    visit();
    // No href here: an <a part="card"> click would navigate and destroy the
    // harness window. href-less cards render <article> and stay interactive.
    mount(
      'noizu-sg-card',
      {},
      '<span slot="header">Quick start</span><p>Body copy lives in the default slot.</p><span slot="footer">5 min read</span>',
    );
    cy.get('noizu-sg-card [slot="header"]').should('contain.text', 'Quick start');
    cy.get('noizu-sg-card [slot="footer"]').should('contain.text', '5 min read');
    cy.get('noizu-sg-card').shadow().find('[data-cy="sg.card"]').should('not.have.attr', 'href');
    cy.get('noizu-sg-card').shadow().find('[data-cy="sg.card"]').click({force: true});
    events().then((evts: any[]) => {
      const selected = evts.filter((e) => e.type === 'sg-card-select');
      expect(selected.length, 'sg-card-select emitted').to.eq(1);
      expect(selected[0].detail).to.deep.eq({href: ''});
    });
    cy.screenshot('styleguide-card-slots-selected');
  });

  it('Given an sg-card-grid, when columns is set, then the grid attr and slotted cards render; and sg-input emits on every keystroke', () => {
    visit();
    mount('noizu-sg-card-grid', {columns: 2}, '<noizu-sg-card>One</noizu-sg-card><noizu-sg-card>Two</noizu-sg-card>');
    cy.get('noizu-sg-card-grid').shadow().find('[data-cy="sg.grid"]').should('have.attr', 'data-columns', '2');
    cy.get('noizu-sg-card-grid noizu-sg-card').should('have.length', 2);
    cy.screenshot('styleguide-card-grid-columns-2');

    visit();
    mount('noizu-sg-input', {name: 'email', type: 'email', value: ''});
    cy.get('noizu-sg-input').shadow().find('[data-cy="sg.input"]').type('ab');
    events().then((evts: any[]) => {
      const inputs = evts.filter((e) => e.type === 'sg-input');
      expect(inputs.length, 'sg-input per keystroke').to.eq(2);
      expect(inputs.at(-1).detail).to.deep.eq({value: 'ab'});
    });
    cy.screenshot('styleguide-input-typed');
  });

  it('Given sg-status, when status/label/description change, then data-status tracks ok/warn/error/idle', () => {
    visit();
    mount('noizu-sg-status', {status: 'ok', label: 'All systems nominal', description: 'Last checked 12:00'});
    cy.get('noizu-sg-status').shadow().find('[data-cy="sg.status"]').should('have.attr', 'data-status', 'ok');
    cy.get('noizu-sg-status').shadow().find('[part="label"]').should('contain.text', 'All systems nominal');
    cy.get('noizu-sg-status').shadow().find('[part="description"]').should('contain.text', 'Last checked 12:00');
    cy.screenshot('styleguide-status-ok');
    cy.window().then((win: any) => {
      const host = win.document.querySelector('noizu-sg-status');
      host.setAttribute('status', 'error');
      host.setAttribute('label', 'Outage');
      host.removeAttribute('description');
    });
    cy.get('noizu-sg-status').shadow().find('[data-cy="sg.status"]').should('have.attr', 'data-status', 'error');
    cy.get('noizu-sg-status').shadow().find('[part="description"]').should('not.exist');
    cy.screenshot('styleguide-status-error');
  });

  it('Given sg-spec-table rows and sg-steps progress, when properties change, then the table and step states render accordingly', () => {
    visit();
    mount('noizu-sg-spec-table', {}, '');
    cy.window().then((win: any) => {
      win.document.querySelector('noizu-sg-spec-table').rows = [
        {key: 'Region', value: 'eu-central'},
        {key: 'Runtime', value: 'OTP 28'},
      ];
    });
    cy.get('noizu-sg-spec-table').shadow().find('[data-cy="sg.spec"] tbody tr').should('have.length', 2);
    cy.get('noizu-sg-spec-table').shadow().find('[data-cy="sg.spec"]').should('contain', 'eu-central').and('contain', 'OTP 28');
    cy.screenshot('styleguide-spec-table');

    visit();
    mount('noizu-sg-steps', {current: 1}, '');
    cy.window().then((win: any) => {
      win.document.querySelector('noizu-sg-steps').steps = ['Account', 'Verify', 'Billing'];
    });
    cy.get('noizu-sg-steps').shadow().find('[data-cy="sg.steps"]').should('have.attr', 'data-current', '1');
    cy.get('noizu-sg-steps').shadow().find('li').should('have.length', 3);
    cy.get('noizu-sg-steps').shadow().find('li').eq(0).should('have.attr', 'data-state', 'done');
    cy.get('noizu-sg-steps').shadow().find('li').eq(1).should('have.attr', 'data-state', 'current');
    cy.get('noizu-sg-steps').shadow().find('li').eq(2).should('have.attr', 'data-state', 'todo');
    cy.screenshot('styleguide-steps-current-1');
  });
});
