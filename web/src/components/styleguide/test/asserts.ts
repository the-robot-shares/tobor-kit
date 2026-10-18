/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const styleguideAsserts = {
  mounted(tag = 'noizu-sg-btn'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'noizu-sg-btn'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  btnVisible(tag = 'noizu-sg-btn'): void {
    inShadow(tag, '[data-cy="sg.btn"]').should('be.visible');
  },
  cardVisible(tag = 'noizu-sg-card'): void {
    inShadow(tag, '[data-cy="sg.card"]').should('be.visible');
  },
  gridVisible(tag = 'noizu-sg-card-grid'): void {
    inShadow(tag, '[data-cy="sg.grid"]').should('be.visible');
  },
  statusVisible(tag = 'noizu-sg-status'): void {
    inShadow(tag, '[data-cy="sg.status"]').should('be.visible');
  },
  inputVisible(tag = 'noizu-sg-input'): void {
    inShadow(tag, '[data-cy="sg.input"]').should('be.visible');
  },
  specVisible(tag = 'noizu-sg-spec-table'): void {
    inShadow(tag, '[data-cy="sg.spec"]').should('exist');
  },
  stepsVisible(tag = 'noizu-sg-steps'): void {
    inShadow(tag, '[data-cy="sg.steps"]').should('exist');
  },
  sgClickFired(tag = 'noizu-sg-btn'): void {
    cy.get(tag).should(($el) => {
      const count = ($el[0] as HTMLElement & {__sgClick?: number}).__sgClick;
      expect(count, 'sg-click count').to.be.greaterThan(0);
    });
  },
  cardSelectFired(href: string, tag = 'noizu-sg-card'): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__sgCardSelect?: {href: string}[]}).__sgCardSelect;
      expect(log, 'sg-card-select log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.include({href});
    });
  },
  gridColumns(columns: number, tag = 'noizu-sg-card-grid'): void {
    inShadow(tag, '[data-cy="sg.grid"]').should('have.attr', 'data-columns', String(columns));
  },
  statusKind(status: string, tag = 'noizu-sg-status'): void {
    inShadow(tag, '[data-cy="sg.status"]').should('have.attr', 'data-status', status);
  },
  sgInputFired(value: string, tag = 'noizu-sg-input'): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__sgInput?: {value: string}[]}).__sgInput;
      expect(log, 'sg-input log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.include({value});
    });
  },
  specCellText(text: string, tag = 'noizu-sg-spec-table'): void {
    inShadow(tag, '[data-cy="sg.spec"]').should('contain.text', text);
  },
  stepsCurrent(current: number, tag = 'noizu-sg-steps'): void {
    inShadow(tag, '[data-cy="sg.steps"]').should('have.attr', 'data-current', String(current));
  },
};
