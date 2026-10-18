/// <reference types="cypress" />
// Isolation lane: tobor-npl-view on the blank harness page, no backend.
// The harness MODULES map predates this family, so the spec imports the built
// module itself, then mounts through the same harness conventions
// (window.__events, attrs/props/slots, named screenshots).
const SOURCE = [
  '# Section One',
  'Body with {{user.name}} and ⌜a placeholder block⌝.',
  'Then an [infill gap] and `highlighted text`.',
  '# Section Two',
  'Second section body with ⟬literal⟭ tokens.',
].join('\n');

function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent = "import '/dist/components/npl-view/npl-view.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(source = '') {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('tobor-npl-view');
    win.unmount();
    win.__events.length = 0;
    const el = win.document.createElement('tobor-npl-view');
    const native = el.dispatchEvent.bind(el);
    el.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    if (source) el.source = source;
    win.document.getElementById('mount-root').appendChild(el);
    return el;
  });
}

describe('Given NPL source, when mounted on the isolation harness, then folding, highlighting and copy work without a backend', () => {
  it('Given a source with fold headings, when rendered, then sections fold open and tokens are highlighted via escaped spans', () => {
    visit();
    mount(SOURCE);
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.view"]').should('be.visible');
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.fold"]').should('have.length', 2);
    cy.get('tobor-npl-view').shadow().find('details').first().should('have.attr', 'open');
    cy.get('tobor-npl-view').shadow().find('.npl-declaration').should('contain', '⌜a placeholder block⌝');
    cy.get('tobor-npl-view').shadow().find('.npl-logic').should('contain', '{{user.name}}');
    cy.get('tobor-npl-view').shadow().find('.npl-infill').should('contain', '[infill gap]');
    cy.get('tobor-npl-view').shadow().find('.npl-highlight').should('contain', '`highlighted text`');
    cy.get('tobor-npl-view').shadow().find('.npl-literal').should('contain', '⟬literal⟭');
    cy.screenshot('npl-view-rendered');
  });

  it('Given an open fold section, when its summary is clicked, then the section collapses and can be re-expanded', () => {
    visit();
    mount(SOURCE);
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.fold"]').first().click();
    cy.get('tobor-npl-view').shadow().find('details').first().should('not.have.attr', 'open');
    cy.screenshot('npl-view-folded');
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.fold"]').first().click();
    cy.get('tobor-npl-view').shadow().find('details').first().should('have.attr', 'open');
    cy.screenshot('npl-view-unfolded');
  });

  it('Given rendered source, when Copy is clicked, then npl-copy carries the full raw source', () => {
    visit();
    mount(SOURCE);
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.copy"]').click();
    cy.window().then((win: any) => {
      const copies = win.__events.filter((e: any) => e.type === 'npl-copy');
      expect(copies.length, 'npl-copy emitted').to.eq(1);
      expect(copies[0].detail).to.deep.eq({text: SOURCE});
    });
    cy.screenshot('npl-view-copied');
  });

  it('Given no source, when mounted, then the empty state renders and Copy is disabled', () => {
    visit();
    mount('');
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.view"]').should('contain', 'No source.');
    cy.get('tobor-npl-view').shadow().find('[data-cy="npl.copy"]').should('be.disabled');
    cy.screenshot('npl-view-empty');
  });
});
