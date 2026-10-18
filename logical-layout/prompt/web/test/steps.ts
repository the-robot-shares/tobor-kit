/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';
import type {PromptHistoryEntry, PromptRecord} from '../types.js';

const SAMPLE_PROMPTS: PromptRecord[] = [
  {
    id: 'sys',
    title: 'System',
    body: 'You are a helpful assistant.\nDo not render HTML.\n<section>stays source</section>',
    starred: true,
  },
  {id: 'brief', title: 'Brief', body: 'Be concise.\nNo HTML.'},
];

const SAMPLE_HISTORY: PromptHistoryEntry[] = [
  {id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1},
  {id: 'sys-v2', title: 'System', at: '2026-02-01T12:00:00Z', version: 2, starred: true},
];

export const promptSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'tobor-prompt-library', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  ensurePrompts(prompts: PromptRecord[] = SAMPLE_PROMPTS, tag = 'tobor-prompt-library'): void {
    cy.get(tag).then(($el) => {
      const node = $el.get(0) as HTMLElement & {prompts: PromptRecord[]};
      node.prompts = prompts;
    });
    inShadow(tag, '[data-cy="prompt.item"]').should('have.length', prompts.length);
  },
  ensureEntries(
    entries: PromptHistoryEntry[] = SAMPLE_HISTORY,
    tag = 'tobor-prompt-history',
  ): void {
    cy.get(tag).then(($el) => {
      const node = $el.get(0) as HTMLElement & {entries: PromptHistoryEntry[]};
      node.entries = entries;
    });
    inShadow(tag, '[data-cy="prompt.fork"]').should('have.length', entries.length);
  },
  typeQuery(value: string, tag = 'tobor-prompt-library'): void {
    inShadow(tag, '[part="search"]').clear().type(value);
  },
  clickItem(id: string, tag = 'tobor-prompt-library'): void {
    inShadow(tag, `[data-cy="prompt.item"][data-prompt-id="${id}"]`).click();
  },
  clickStar(id: string, tag = 'tobor-prompt-library'): void {
    inShadow(tag, `[data-cy="prompt.star"][data-prompt-id="${id}"]`).click();
  },
  clickFork(id: string, tag = 'tobor-prompt-history'): void {
    inShadow(tag, `[data-cy="prompt.fork"][data-prompt-id="${id}"]`).click();
  },
  captureSelect(): void {
    cy.window().then((win) => {
      const state = win as Window & {__promptSelect?: {id: string}};
      win.document.addEventListener('prompt-select', (event) => {
        state.__promptSelect = (event as CustomEvent<{id: string}>).detail;
      });
    });
  },
  captureStar(): void {
    cy.window().then((win) => {
      const state = win as Window & {__promptStar?: {id: string; starred: boolean}};
      win.document.addEventListener('prompt-star', (event) => {
        state.__promptStar = (event as CustomEvent<{id: string; starred: boolean}>).detail;
      });
    });
  },
  captureFork(): void {
    cy.window().then((win) => {
      const state = win as Window & {__promptFork?: {id: string}};
      win.document.addEventListener('prompt-fork', (event) => {
        state.__promptFork = (event as CustomEvent<{id: string}>).detail;
      });
    });
  },
};
