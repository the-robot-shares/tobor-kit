/// <reference types="cypress" />
// Given/When/Then helpers for the noizu-page-comments live-host spec.
// The island renders into body-appended shadow layers, so every lookup goes
// through the layer tag's shadow root.

export const pageCommentsSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-page-comments', timeout = 15_000): void {
    cy.window().then((win) => win.customElements.whenDefined(tag), {timeout});
  },
  enable(): void {
    cy.window().then((win) => {
      const el = win.document.querySelector('noizu-page-comments') as HTMLElement & {enabled: boolean} | null;
      if (el && !el.enabled) el.enabled = true;
    });
  },
  launcher(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.launcher"]');
  },
  pickButton(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.pick"]');
  },
  /** Enter pick mode via the rail's "+ Comment" button. */
  startPick(): void {
    pageCommentsSteps.pickButton().click();
  },
  rail(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.rail"]');
  },
  card(threadId?: string): Cypress.Chainable {
    const selector = threadId ? `[data-cy="comments.card"][data-thread-id="${threadId}"]` : '[data-cy="comments.card"]';
    return cy.get('noizu-page-comments-rail').shadow().find(selector);
  },
  orphanSection(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.orphan-section"]');
  },
  composer(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.composer"]');
  },
  composerCard(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.composer-card"]');
  },
  composerSend(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.composer-send"]');
  },
  ring(threadId: string): Cypress.Chainable {
    return cy.get('noizu-page-comments-overlay').shadow().find(`[data-cy="comments.ring"][data-thread-id="${threadId}"]`);
  },
  /* ---- attachments + screenshots ---- */
  attachButton(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.attach"]');
  },
  screenshotButton(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.screenshot"]');
  },
  screenCaptureButton(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.screen-capture"]');
  },
  fileInput(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.file-input"]');
  },
  pendingChips(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.pending-chip"]');
  },
  notice(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.notice"]');
  },
  attachmentThumbs(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.attachment-image"]');
  },
  annotationEditButtons(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.annotation-edit"]');
  },
  replyField(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.reply-field"]');
  },
  replySend(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.reply-send"]');
  },
  replyChips(): Cypress.Chainable {
    return cy
      .get('noizu-page-comments-rail')
      .shadow()
      .find('[data-cy="comments.reply-chips"] [data-cy="comments.pending-chip"]');
  },
  snipModal(): Cypress.Chainable {
    return cy.get('noizu-page-comments-snip').shadow().find('[data-cy="comments.snip-modal"]');
  },
  snipButton(name: 'snip-apply' | 'snip-save' | 'snip-cancel' | 'snip-recrop' | 'undo' | 'redo' | 'clear'): Cypress.Chainable {
    return cy.get('noizu-page-comments-snip').shadow().find(`[data-cy="comments.${name}"]`);
  },
  snipTool(tool: string): Cypress.Chainable {
    return cy.get('noizu-page-comments-snip').shadow().find(`[data-cy="comments.tool-${tool}"]`);
  },
  annotateCanvas(): Cypress.Chainable {
    return cy.get('noizu-page-comments-snip').shadow().find('[data-cy="comments.annotate-canvas"]');
  },
  lightbox(): Cypress.Chainable {
    return cy.get('noizu-page-comments-lightbox').shadow().find('[data-cy="comments.lightbox"]');
  },
  /* ---- realtime + rail polish ---- */
  tab(name: 'open' | 'resolved' | 'all'): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find(`[data-cy="comments.tab-${name}"]`);
  },
  newPill(): Cypress.Chainable {
    return cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.new-pill"]');
  },
  unreadDot(threadId: string): Cypress.Chainable {
    return cy
      .get('noizu-page-comments-rail')
      .shadow()
      .find(`[data-cy="comments.card"][data-thread-id="${threadId}"] [data-cy="comments.unread-dot"]`);
  },
  /* ---- text-anchor flow ---- */
  selectionPill(): Cypress.Chainable {
    return cy.get('noizu-page-comments-overlay').shadow().find('[data-cy="comments.selection-pill"]');
  },
  /** Select an element's full contents programmatically (fires selectionchange). */
  selectElement(selector: string): void {
    cy.window().then((win) => {
      const el = win.document.querySelector(selector)!;
      const range = win.document.createRange();
      range.selectNodeContents(el);
      const selection = win.document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
  },
  /** Range over words [wordStart, wordEnd) of an element's flat text. */
  wordRange(selector: string, wordStart: number, wordEnd: number): Cypress.Chainable {
    return cy.window().then((win) => {
      const doc = win.document;
      const el = doc.querySelector(selector)!;
      const range = doc.createRange();
      let seen = 0;
      let done = false;
      const walker = doc.createTreeWalker(el, win.NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node && !done) {
        const text = node.textContent ?? '';
        let offset = 0;
        for (const word of text.split(/(\s+)/)) {
          if (!word.trim()) {
            offset += word.length;
            continue;
          }
          if (seen === wordStart) range.setStart(node, offset);
          if (seen === wordEnd - 1) {
            range.setEnd(node, offset + word.length);
            done = true;
            break;
          }
          seen += 1;
          offset += word.length;
        }
        if (!done) node = walker.nextNode();
      }
      return range;
    });
  },
  /** Select words [wordStart, wordEnd) of an element's flat text. */
  selectTextRange(selector: string, wordStart: number, wordEnd: number): void {
    cy.window().then((win) => {
      pageCommentsSteps
        .wordRange(selector, wordStart, wordEnd)
        .then((range) => {
          const selection = win.document.getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range as Range);
        });
    });
  },
  /** Dispatch an Alt+Shift+C keydown on the host body. */
  pressAltShiftC(): void {
    cy.window().then((win) => {
      win.document.body.dispatchEvent(
        new win.KeyboardEvent('keydown', {
          key: 'C',
          code: 'KeyC',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  },
  /** A demo MemoryDataSource store thread by body text. */
  storedThread(body: string): Cypress.Chainable {
    cy.window().then((win) => {
      const demo = (win as unknown as {
        __pcDemo: {source: {store: Map<string, {body_md: string}>}};
      }).__pcDemo;
      const found = [...demo.source.store.values()].find((thread) => thread.body_md === body);
      expect(found, `stored thread "${body}"`).to.exist;
      cy.wrap(found!).as('storedThread');
    });
  },
  /** Push one simulated realtime event through the demo MemoryDataSource. */
  emitRealtime(event: unknown): void {
    cy.window().then((win) => {
      (win as unknown as {__pcDemo: {source: {emitRealtime: (event: unknown) => void}}}).__pcDemo.source.emitRealtime(event);
    });
  },
  /** Anchor an element id's top against a card's rendered top (± tolerance px). */
  cardAlignsWithAnchor(threadId: string, anchorSelector: string, tolerance = 4): void {
    cy.window().then((win) => {
      const anchorTop = win.document.querySelector(anchorSelector)!.getBoundingClientRect().top;
      cy.get('noizu-page-comments-rail')
        .shadow()
        .find(`[data-cy="comments.card"][data-thread-id="${threadId}"]`)
        .then(($card) => {
          const cardTop = ($card[0] as HTMLElement).getBoundingClientRect().top;
          expect(Math.abs(cardTop - anchorTop), `card top ${cardTop} vs anchor top ${anchorTop}`).to.be.at.most(tolerance);
        });
    });
  },
};
