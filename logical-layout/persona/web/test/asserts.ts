/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const CARD = 'tobor-persona-card';
const PICKER = 'tobor-persona-picker';

export const personaAsserts = {
  mounted(tag = CARD): void {
    assertMounted(tag);
  },
  catalogMounted(tag = CARD): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    kitNoLoadError();
  },
  cardVisible(tag = CARD): void {
    inShadow(tag, '[data-cy="persona.card"]').should('be.visible');
  },
  pickerVisible(tag = PICKER): void {
    inShadow(tag, '[data-cy="persona.picker"]').should('be.visible');
    inShadow(tag, '[data-cy="persona.search"]').should('exist');
  },
  itemCount(count: number, tag = PICKER): void {
    inShadow(tag, '[data-cy="persona.item"]').should('have.length', count);
  },
  lastSelect(personaId: string): void {
    cy.window().its('__personaSelect').should('deep.equal', {personaId});
  },
};
