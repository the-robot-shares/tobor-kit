/// <reference types="cypress" />
import {assetAsserts as asserts} from '../asserts';
import {SAMPLE_TEXT_ASSET, assetSteps as steps} from '../steps';

describe('tobor-asset-editor (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-asset-editor');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-asset-editor');
    asserts.noLoadError();
    asserts.editorVisible();
    asserts.saveVisible();
  });

  it('emits asset-save for the host to persist', () => {
    // Given a host-owned text snapshot
    steps.waitDefined('tobor-asset-editor');
    steps.setAsset(SAMPLE_TEXT_ASSET, 'tobor-asset-editor');
    steps.captureAssetSave();
    // When the visitor renames and saves
    steps.typeName('renamed.txt');
    steps.save();
    // Then the host receives asset-save {id, name, body}
    asserts.assetSaveFired({
      id: SAMPLE_TEXT_ASSET.id,
      name: 'renamed.txt',
      body: SAMPLE_TEXT_ASSET.body,
    });
  });
});
