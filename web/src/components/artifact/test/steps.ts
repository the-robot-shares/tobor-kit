/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';
import type {Artifact} from '../types.js';

const VIEW = 'tobor-artifact-view';
const EDITOR = 'tobor-artifact-editor';

const SAMPLE: Artifact = {
  id: 'demo',
  title: 'Release notes',
  version: 1,
  body: 'Ship the island.',
  mime: 'text/plain',
};

export const artifactSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = VIEW, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setArtifact(artifact: Artifact = SAMPLE, tag = VIEW): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {artifact: Artifact | null};
      node.artifact = artifact;
    });
  },
  captureReview(tag = VIEW): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__reviews?: {artifactId: string; version: string | number}[]};
      node.__reviews = [];
      node.addEventListener('review-start', (event) => {
        node.__reviews?.push(
          (event as CustomEvent<{artifactId: string; version: string | number}>).detail,
        );
      });
    });
  },
  captureSaves(tag = EDITOR): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __saves?: {id: string; title: string; body: string; version?: string | number}[];
      };
      node.__saves = [];
      node.addEventListener('artifact-save', (event) => {
        node.__saves?.push(
          (event as CustomEvent<{id: string; title: string; body: string; version?: string | number}>)
            .detail,
        );
      });
    });
  },
  startReview(tag = VIEW): void {
    inShadow(tag, '[data-cy="artifact.review"]').click();
  },
  fillTitle(value: string, tag = EDITOR): void {
    inShadow(tag, 'input[name="title"]').clear().type(value);
  },
  fillBody(value: string, tag = EDITOR): void {
    inShadow(tag, 'textarea[name="body"]').clear().type(value);
  },
  save(tag = EDITOR): void {
    inShadow(tag, '[data-cy="artifact.save"]').click();
  },
};
