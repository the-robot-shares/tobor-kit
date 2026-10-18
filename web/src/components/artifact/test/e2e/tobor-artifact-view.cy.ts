/// <reference types="cypress" />
import {artifactAsserts as asserts} from '../asserts';
import {artifactSteps as steps} from '../steps';

describe('tobor-artifact-view (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined();
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted();
    asserts.noLoadError();
    asserts.viewVisible();
  });

  it('emits review-start for the current version', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.setArtifact({
      id: 'demo',
      title: 'Release notes',
      version: 1,
      body: 'Ship the island.',
      mime: 'text/plain',
    });
    asserts.bodyText('Ship the island.');
    steps.captureReview();
    // When the reviewer starts a review
    steps.startReview();
    // Then the host receives artifactId + version
    asserts.lastReview({artifactId: 'demo', version: 1});
  });
});
