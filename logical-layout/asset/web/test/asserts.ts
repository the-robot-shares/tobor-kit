/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const assetAsserts = {
  mounted(tag = 'tobor-asset-view'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'tobor-asset-view'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  viewVisible(tag = 'tobor-asset-view'): void {
    inShadow(tag, '[data-cy="asset.view"]').should('exist');
  },
  previewVisible(tag = 'tobor-asset-view'): void {
    inShadow(tag, '[data-cy="asset.preview"]').should('be.visible');
  },
  previewKind(kind: 'image' | 'text' | 'other', tag = 'tobor-asset-view'): void {
    inShadow(tag, '[data-cy="asset.preview"]').should('have.attr', 'data-kind', kind);
  },
  editorVisible(tag = 'tobor-asset-editor'): void {
    inShadow(tag, '[data-cy="asset.editor"]').should('exist');
  },
  saveVisible(tag = 'tobor-asset-editor'): void {
    inShadow(tag, '[data-cy="asset.save"]').should('be.visible');
  },
  assetOpenFired(id?: string, tag = 'tobor-asset-view'): void {
    cy.get(tag).should(($el) => {
      const node = $el[0] as HTMLElement & {__assetOpen?: number; __assetOpenId?: string};
      expect(node.__assetOpen, 'asset-open count').to.be.greaterThan(0);
      if (id) expect(node.__assetOpenId).to.equal(id);
    });
  },
  assetSaveFired(
    expected?: {id: string; name: string; body?: string},
    tag = 'tobor-asset-editor',
  ): void {
    cy.get(tag).should(($el) => {
      const node = $el[0] as HTMLElement & {
        __assetSave?: number;
        __assetSaveDetail?: {id: string; name: string; body?: string};
      };
      expect(node.__assetSave, 'asset-save count').to.be.greaterThan(0);
      if (expected) expect(node.__assetSaveDetail).to.deep.equal(expected);
    });
  },
};
