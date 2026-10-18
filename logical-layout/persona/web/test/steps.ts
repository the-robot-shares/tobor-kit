/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';
import type {PersonaEntry} from '../types.js';

const CARD = 'tobor-persona-card';
const PICKER = 'tobor-persona-picker';

const SAMPLE: PersonaEntry[] = [
  {id: 'nova', name: 'Nova', handle: '@nova'},
  {id: 'orbit', name: 'Orbit', handle: '@orbit'},
  {id: 'pip', name: 'Pip'},
];

export const personaSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = CARD, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureSelect(): void {
    cy.window().then((win) => {
      const state = win as Window & {__personaSelect?: {personaId: string}};
      win.document.addEventListener('persona-select', (event) => {
        state.__personaSelect = (event as CustomEvent<{personaId: string}>).detail;
      });
    });
  },
  ensurePersonas(personas: PersonaEntry[] = SAMPLE, tag = PICKER): void {
    cy.get(tag).then(($el) => {
      const node = $el.get(0) as HTMLElement & {personas: PersonaEntry[]};
      node.personas = personas;
    });
    inShadow(tag, '[data-cy="persona.item"]').should('have.length', personas.length);
  },
  typeQuery(value: string, tag = PICKER): void {
    inShadow(tag, '[data-cy="persona.search"]').clear().type(value);
  },
  clickSelect(tag = CARD): void {
    inShadow(tag, '[part="select"]').click();
  },
  clickItem(personaId: string, tag = PICKER): void {
    inShadow(tag, `[data-cy="persona.item"][data-persona-id="${personaId}"]`).click();
  },
};
