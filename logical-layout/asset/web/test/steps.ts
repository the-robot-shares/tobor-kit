/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const SAMPLE_TEXT_ASSET = {
  id: 'note-1',
  name: 'readme.txt',
  mime: 'text/plain',
  body: 'Hello from the host.',
};

export const assetSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'tobor-asset-view', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setAsset(
    asset: {id: string; name: string; mime: string; src?: string; body?: string},
    tag = 'tobor-asset-view',
  ): void {
    cy.get(tag).then(($el) => {
      ($el[0] as HTMLElement & {asset?: unknown}).asset = asset;
    });
  },
  clickPreview(tag = 'tobor-asset-view'): void {
    inShadow(tag, '[data-cy="asset.preview"]').click();
  },
  captureAssetOpen(tag = 'tobor-asset-view'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__assetOpen?: number; __assetOpenId?: string};
      node.__assetOpen = 0;
      node.addEventListener('asset-open', (event: Event) => {
        node.__assetOpen = (node.__assetOpen ?? 0) + 1;
        node.__assetOpenId = (event as CustomEvent<{id: string}>).detail?.id;
      });
    });
  },
  typeName(value: string, tag = 'tobor-asset-editor'): void {
    inShadow(tag, 'input[name="name"]').clear().type(value);
  },
  save(tag = 'tobor-asset-editor'): void {
    inShadow(tag, '[data-cy="asset.save"]').click();
  },
  captureAssetSave(tag = 'tobor-asset-editor'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __assetSave?: number;
        __assetSaveDetail?: {id: string; name: string; body?: string};
      };
      node.__assetSave = 0;
      node.addEventListener('asset-save', (event: Event) => {
        node.__assetSave = (node.__assetSave ?? 0) + 1;
        node.__assetSaveDetail = (event as CustomEvent<{id: string; name: string; body?: string}>)
          .detail;
      });
    });
  },
};
