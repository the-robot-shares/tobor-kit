/// <reference types="cypress" />
import {pageCommentsSteps} from './steps';

export const pageCommentsAsserts = {
  mounted(tag = 'noizu-page-comments'): void {
    cy.get(tag).should('exist');
    cy.get('noizu-page-comments-rail').should('exist');
  },
  noLoadError(): void {
    cy.get('body').should('not.contain', "Couldn't load");
    cy.get('body').should('not.contain', 'may not be published');
  },
  railVisible(): void {
    pageCommentsSteps.rail().should('be.visible');
  },
  cardCount(min: number): void {
    pageCommentsSteps.card().should('have.length.at.least', min);
  },
  orphaned(threadId: string): void {
    pageCommentsSteps
      .orphanSection()
      .find(`[data-thread-id="${threadId}"]`)
      .should('exist');
  },
  ringAroundAnchor(threadId: string): void {
    pageCommentsSteps.ring(threadId).should('be.visible');
  },
  /* ---- attachments + screenshots ---- */
  pendingChipState(state: 'uploading' | 'ready' | 'error'): void {
    pageCommentsSteps.pendingChips().should('have.attr', 'data-state', state);
  },
  pendingChipCount(count: number): void {
    pageCommentsSteps.pendingChips().should('have.length', count);
  },
  replyChipState(state: 'uploading' | 'ready' | 'error'): void {
    pageCommentsSteps.replyChips().should('have.attr', 'data-state', state);
  },
  attachmentThumbCount(min: number): void {
    pageCommentsSteps.attachmentThumbs().should('have.length.at.least', min);
  },
  lightboxOpen(): void {
    pageCommentsSteps.lightbox().should('be.visible');
  },
  lightboxClosed(): void {
    cy.get('noizu-page-comments-lightbox').shadow().find('[data-cy="comments.lightbox"]').should('not.exist');
  },
};
