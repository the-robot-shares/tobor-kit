/// <reference types="cypress" />
import {authAsserts} from './asserts';
import {authSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      authVisit(path?: string): void;
      authWaitDefined(tag?: string, timeout?: number): void;
      authMount(): void;
      authNoLoadError(): void;
      authCardVisible(): void;
      authFillEmail(value: string): void;
      authFillPassword(value: string): void;
      authSubmit(): void;
      authClickProvider(id?: string): void;
      authSetPipes(pipes: string[]): void;
      authOpenDropdown(): void;
      authSelectPipe(id: string): void;
      authDropdownOpen(): void;
      authDropdownClosed(): void;
      authSetSmsRegions(smsRegions: {supported: string[]; message?: string} | undefined): void;
      authSetMobileCountry(country: string, dial: string): void;
      authFillMobilePhone(value: string): void;
      authSmsRegionNoticeHidden(): void;
      authSmsRegionNoticeVisible(message?: string): void;
      authMobilePipeSubmitBlocked(): void;
    }
  }
}

Cypress.Commands.add('authVisit', (path?: string) => authSteps.visit(path));
Cypress.Commands.add('authWaitDefined', (tag?: string, timeout?: number) =>
  authSteps.waitDefined(tag, timeout),
);
Cypress.Commands.add('authMount', () => {
  authSteps.waitDefined();
  authAsserts.mounted();
});
Cypress.Commands.add('authNoLoadError', () => authAsserts.noLoadError());
Cypress.Commands.add('authCardVisible', () => authAsserts.cardVisible());
Cypress.Commands.add('authFillEmail', (value: string) => authSteps.fillEmail(value));
Cypress.Commands.add('authFillPassword', (value: string) => authSteps.fillPassword(value));
Cypress.Commands.add('authSubmit', () => authSteps.submit());
Cypress.Commands.add('authClickProvider', (id?: string) => authSteps.clickProvider(id));
Cypress.Commands.add('authSetPipes', (pipes: string[]) => authSteps.setPipes(pipes));
Cypress.Commands.add('authOpenDropdown', () => authSteps.openDropdown());
Cypress.Commands.add('authSelectPipe', (id: string) => authSteps.selectPipe(id));
Cypress.Commands.add('authDropdownOpen', () => authAsserts.dropdownOpen());
Cypress.Commands.add('authDropdownClosed', () => authAsserts.dropdownClosed());
Cypress.Commands.add('authSetSmsRegions', (smsRegions) => authSteps.setSmsRegions(smsRegions));
Cypress.Commands.add('authSetMobileCountry', (country: string, dial: string) =>
  authSteps.setMobileCountry(country, dial),
);
Cypress.Commands.add('authFillMobilePhone', (value: string) => authSteps.fillMobilePhone(value));
Cypress.Commands.add('authSmsRegionNoticeHidden', () => authAsserts.smsRegionNoticeHidden());
Cypress.Commands.add('authSmsRegionNoticeVisible', (message?: string) =>
  authAsserts.smsRegionNoticeVisible(message),
);
Cypress.Commands.add('authMobilePipeSubmitBlocked', () => authAsserts.mobilePipeSubmitBlocked());

export {};
