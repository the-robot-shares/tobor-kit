/// <reference types="cypress" />
import {promptAsserts as asserts} from '../asserts';
import {promptSteps as steps} from '../steps';

describe('tobor-prompt-history (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-prompt-history');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-prompt-history');
    asserts.noLoadError();
    asserts.history();
  });

  it('emits prompt-fork and prompt-star from history rows', () => {
    steps.waitDefined('tobor-prompt-history');
    asserts.history();
    steps.ensureEntries();
    asserts.forkCount(2);
    steps.captureFork();
    steps.captureStar();
    // When the visitor forks a revision
    steps.clickFork('sys-v1');
    asserts.lastFork('sys-v1');
    // When the visitor stars a revision
    steps.clickStar('sys-v1', 'tobor-prompt-history');
    asserts.lastStar({id: 'sys-v1', starred: true});
  });
});
