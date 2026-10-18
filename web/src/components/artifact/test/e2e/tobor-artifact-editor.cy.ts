/// <reference types="cypress" />
import {artifactAsserts as asserts} from '../asserts';
import {artifactSteps as steps} from '../steps';

describe('tobor-artifact-editor (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-artifact-editor');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-artifact-editor');
    asserts.noLoadError();
    asserts.editorVisible();
  });

  it('emits artifact-save for the host to persist', () => {
    steps.waitDefined('tobor-artifact-editor');
    asserts.mounted('tobor-artifact-editor');
    steps.setArtifact(
      {
        id: 'demo',
        title: 'Release notes',
        version: 1,
        body: 'Ship the island.',
      },
      'tobor-artifact-editor',
    );
    steps.captureSaves();
    // When the author edits and saves
    steps.fillTitle('Edited title');
    steps.fillBody('Edited body');
    steps.save();
    // Then the host receives the draft (kit does not persist)
    asserts.lastSave({id: 'demo', title: 'Edited title', body: 'Edited body', version: 1});
  });
});
