/// <reference types="cypress" />
import {inShadow, waitDefined as waitTagDefined} from '../../../lit-test/cypress.js';

export const authSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-auth', timeout = 15_000): void {
    waitTagDefined(tag, timeout);
  },
  fillEmail(value: string): void {
    inShadow('noizu-auth', '[data-cy="email-input"]').clear().type(value);
  },
  fillPassword(value: string): void {
    inShadow('noizu-auth', '[data-cy="password-input"]').clear().type(value);
  },
  submit(): void {
    inShadow('noizu-auth', 'button[type="submit"]').click();
  },
  clickProvider(id?: string): void {
    const sel = id
      ? `[data-cy="sso-provider-link"][data-provider="${id}"]`
      : '[data-cy="sso-provider-link"]';
    inShadow('noizu-auth', sel).first().click();
  },
  openModal(): void {
    cy.get('noizu-auth').then(($el) => {
      ($el[0] as HTMLElement & {open: boolean}).open = true;
    });
  },
  setPipes(pipes: string[]): void {
    cy.get('noizu-auth').then(($el) => {
      ($el[0] as HTMLElement & {pipes: string[]}).pipes = pipes;
    });
  },
  setSmsRegions(smsRegions: {supported: string[]; message?: string} | undefined): void {
    cy.get('noizu-auth').then(($el) => {
      ($el[0] as HTMLElement & {smsRegions?: typeof smsRegions}).smsRegions = smsRegions;
    });
  },
  setInviteTokenMode(mode: string): void {
    cy.get('noizu-auth').then(($el) => {
      ($el[0] as HTMLElement & {inviteTokenMode: string}).inviteTokenMode = mode;
    });
  },
  showSignup(): void {
    inShadow('noizu-auth', '[part~="flow-toggle"]').click();
  },
  setMobileCountry(country: string, dial: string): void {
    inShadow('noizu-auth', 'noizu-phone-input').then(($phone) => {
      $phone[0].dispatchEvent(new CustomEvent('country-change', {detail: {country, dial}}));
    });
  },
  fillMobilePhone(value: string): void {
    inShadow('noizu-auth', 'noizu-phone-input').then(($phone) => {
      const phone = $phone[0] as HTMLElement & {value: string};
      phone.value = value;
      phone.dispatchEvent(new CustomEvent('phone-change', {detail: {value}}));
    });
  },
  openDropdown(): void {
    inShadow('noizu-auth', '[data-cy="auth-dropdown-trigger"]').click();
  },
  selectPipe(id: string): void {
    inShadow('noizu-auth', `[data-cy="pipe-${id.replace(/_/g, '-')}"]`).click();
  },
  escape(): void {
    cy.get('body').type('{esc}');
  },
  clickOutside(): void {
    cy.get('body').click(2, 2);
  },
};
