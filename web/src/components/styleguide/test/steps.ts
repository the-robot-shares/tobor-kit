/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const styleguideSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-sg-btn', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  clickBtn(tag = 'noizu-sg-btn'): void {
    inShadow(tag, '[data-cy="sg.btn"]').click();
  },
  clickCard(tag = 'noizu-sg-card'): void {
    inShadow(tag, '[data-cy="sg.card"]').click();
  },
  captureSgClick(tag = 'noizu-sg-btn'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__sgClick?: number};
      node.__sgClick = 0;
      node.addEventListener('sg-click', () => {
        node.__sgClick = (node.__sgClick ?? 0) + 1;
      });
    });
  },
  captureCardSelect(tag = 'noizu-sg-card'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__sgCardSelect?: {href: string}[]};
      const log: {href: string}[] = [];
      node.__sgCardSelect = log;
      node.addEventListener('sg-card-select', (event) => {
        event.preventDefault();
        log.push((event as CustomEvent<{href: string}>).detail);
      });
    });
  },
  setColumns(columns: number, tag = 'noizu-sg-card-grid'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {columns: number};
      node.columns = columns;
      node.setAttribute('columns', String(columns));
    });
  },
  typeInput(value: string, tag = 'noizu-sg-input'): void {
    inShadow(tag, '[data-cy="sg.input"]').clear().type(value);
  },
  captureSgInput(tag = 'noizu-sg-input'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__sgInput?: {value: string}[]};
      const log: {value: string}[] = [];
      node.__sgInput = log;
      node.addEventListener('sg-input', (event) => {
        log.push((event as CustomEvent<{value: string}>).detail);
      });
    });
  },
  setRows(rows: {key: string; value: string}[], tag = 'noizu-sg-spec-table'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {rows: {key: string; value: string}[]};
      node.rows = rows;
    });
  },
  setSteps(steps: string[], tag = 'noizu-sg-steps'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {steps: string[]};
      node.steps = steps;
    });
  },
  setCurrent(current: number, tag = 'noizu-sg-steps'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {current: number};
      node.current = current;
      node.setAttribute('current', String(current));
    });
  },
};
