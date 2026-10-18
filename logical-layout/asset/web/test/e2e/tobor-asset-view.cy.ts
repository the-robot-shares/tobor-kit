/// <reference types="cypress" />
import {assetAsserts as asserts} from '../asserts';
import {SAMPLE_TEXT_ASSET, assetSteps as steps} from '../steps';

describe('tobor-asset-view (live host)', () => {
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

  it('previews text and emits asset-open', () => {
    // Given a host-owned text snapshot
    steps.waitDefined();
    steps.setAsset(SAMPLE_TEXT_ASSET);
    steps.captureAssetOpen();
    // When the visitor opens the preview
    asserts.previewVisible();
    asserts.previewKind('text');
    steps.clickPreview();
    // Then the host receives asset-open {id}
    asserts.assetOpenFired(SAMPLE_TEXT_ASSET.id);
  });
});
