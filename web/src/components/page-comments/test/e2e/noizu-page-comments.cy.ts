/// <reference types="cypress" />
import {pageCommentsAsserts as asserts} from '../asserts';
import {pageCommentsSteps as steps} from '../steps';

// Demo page: web/demo/page-comments.html — MemoryDataSource, dynamic content.
// Host override: CYPRESS_BASE_URL + COMPONENT_PATH (cypress.config.ts).

describe('noizu-page-comments (live host)', () => {
  const THREAD_ID = 'demo-1';
  const ANCHOR = '#pc-demo-anchor';

  beforeEach(() => {
    // Given a host page that mounts the island with a seeded MemoryDataSource
    steps.visit(Cypress.env('COMPONENT_PATH') || '/demo/page-comments.html');
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    steps.enable();
    steps.rail().should('be.visible');
  });

  it('mounts and registers the custom element and layers', () => {
    // Then the controller and both layers are registered
    steps.waitDefined('noizu-page-comments-rail');
    steps.waitDefined('noizu-page-comments-overlay');
    asserts.cardCount(1);
  });

  it('picks an element, creates a thread, and lists both cards', () => {
    // When "+ Comment" enters pick mode, the picker selects an element and
    // the composer submits
    steps.startPick();
    cy.window().then((win) => {
      const target = win.document.querySelector('#pc-demo-pick')!;
      const rect = target.getBoundingClientRect();
      cy.get('body').click(rect.left + rect.width / 2, rect.top + rect.height / 2, {force: false});
    });
    steps.composer().should('be.visible').type('Cypress-picked thread');
    steps.composerSend().click();
    // Then the new card exists next to the seeded one
    cy.get('noizu-page-comments-rail')
      .shadow()
      .find('[data-cy="comments.card"]')
      .contains('Cypress-picked thread')
      .should('exist');
    asserts.cardCount(2);
  });

  it('leaves host links working while enabled but not picking', () => {
    // Enabled shows the rail + launcher only; host clicks must pass
    // through untouched (no composer, real navigation).
    cy.get('#pc-demo-link').click();
    cy.location('hash').should('eq', '#pc-demo-target');
    steps.composerCard().should('not.exist');
  });

  it('exits pick mode on Esc so host clicks pass through again', () => {
    steps.startPick();
    steps.pickButton().should('have.attr', 'aria-pressed', 'true');
    cy.get('body').type('{esc}');
    steps.pickButton().should('not.have.attr', 'aria-pressed');
    cy.get('#pc-demo-link').click();
    cy.location('hash').should('eq', '#pc-demo-target');
    steps.composerCard().should('not.exist');
  });

  it('keeps a single card aligned with its anchor after scroll', () => {
    // Only the seeded thread exists, so its card sits at its ideal top
    // (no collision stacking, no focus pinning) and must track the anchor
    // viewport position within ±4px as the page scrolls. The scroll offset
    // keeps the anchor inside the layout clamp band.
    cy.window().then((win) => win.scrollTo(0, 60));
    cy.wait(600); // rAF-throttled recompute
    cy.window().then((win) => {
      const anchorTop = win.document.querySelector(ANCHOR)!.getBoundingClientRect().top;
      cy.get('noizu-page-comments-rail')
        .shadow()
        .find(`[data-cy="comments.card"][data-thread-id="${THREAD_ID}"]`)
        .then(($cards) => {
          const cardTop = ($cards[0] as HTMLElement).getBoundingClientRect().top;
          expect(Math.abs(cardTop - anchorTop), 'card vs anchor top').to.be.at.most(4);
        });
    });
  });

  it('draws a ring around the anchor when its card is clicked', () => {
    // When a card is clicked the anchor scrolls into view and a ring appears
    steps.card(THREAD_ID).click();
    asserts.ringAroundAnchor(THREAD_ID);
    // And the ring sits over the anchor's viewport rect
    cy.window().then((win) => {
      const rect = win.document.querySelector(ANCHOR)!.getBoundingClientRect();
      steps.ring(THREAD_ID).then(($ring) => {
        const box = ($ring[0] as HTMLElement).getBoundingClientRect();
        expect(Math.abs(box.top - rect.top)).to.be.at.most(4);
        expect(Math.abs(box.left - rect.left)).to.be.at.most(4);
      });
    });
  });

  it('lists the thread under Orphaned when the DOM mutation removes its anchor', () => {
    // When the anchor element is removed from the page
    cy.window().then((win) => {
      win.document.querySelector(ANCHOR)!.remove();
    });
    // Then the MutationObserver reload marks the thread orphaned
    asserts.orphaned(THREAD_ID);
  });

  /* ---- attachments + screenshots ---- */

  const PNG_1X1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const openComposer = (): void => {
    steps.startPick();
    cy.window().then((win) => {
      const target = win.document.querySelector('#pc-demo-pick')!;
      const rect = target.getBoundingClientRect();
      cy.get('body').click(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    steps.composer().should('be.visible');
  };

  it('attaches an image, posts it, and opens the lightbox', () => {
    openComposer();
    // When a PNG is chosen through the composer's file input
    steps.fileInput().selectFile(
      {
        contents: Cypress.Blob.base64StringToBlob(PNG_1X1, 'image/png'),
        fileName: 'tiny.png',
        mimeType: 'image/png',
      },
      {force: true},
    );
    // Then the chip uploads against the MemoryDataSource and turns ready
    asserts.pendingChipState('ready');
    steps.composer().type('thread with attachment');
    steps.composerSend().click();
    // And the card shows the thumbnail, which opens and closes the lightbox
    asserts.attachmentThumbCount(1);
    steps.attachmentThumbs().first().click();
    asserts.lightboxOpen();
    cy.get('noizu-page-comments-lightbox').shadow().find('[data-cy="comments.lightbox-close"]').click();
    asserts.lightboxClosed();
  });

  it('flags a rejected file type as an error chip and blocks send', () => {
    openComposer();
    // When an SVG (not on the allowlist) is chosen
    steps.fileInput().selectFile(
      {
        contents: Cypress.Blob.base64StringToBlob('PHN2Zy8+', 'image/svg+xml'),
        fileName: 'evil.svg',
        mimeType: 'image/svg+xml',
      },
      {force: true},
    );
    // Then the chip errors client-side with no wasted upload
    asserts.pendingChipState('error');
    steps.composerSend().should('be.disabled');
    // And removing the chip unblocks sending
    cy.get('noizu-page-comments-rail')
      .shadow()
      .find('[data-cy="comments.pending-chip"] [data-cy="comments.pending-remove"]')
      .click();
    asserts.pendingChipCount(0);
    steps.composerSend().should('not.be.disabled');
  });

  it('accepts a pasted image as a pending upload', () => {
    openComposer();
    // When an image file is pasted into the composer textarea
    steps
      .composer()
      .then(($area) => {
        const view = $area[0].ownerDocument.defaultView!;
        const blob = Cypress.Blob.base64StringToBlob(PNG_1X1, 'image/png') as unknown as Blob;
        const dt = new view.DataTransfer();
        dt.items.add(new view.File([blob], 'pasted.png', {type: 'image/png'}));
        $area[0].dispatchEvent(new view.ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
      });
    // Then it becomes a pending upload and completes
    asserts.pendingChipState('ready');
  });

  it('captures a page screenshot, annotates it, posts it, and re-edits the annotation', () => {
    openComposer();
    // When a page screenshot is captured and the default crop accepted
    steps.screenshotButton().should('not.be.disabled').click();
    steps.snipModal().should('be.visible');
    steps.snipButton('snip-apply').click();
    // Then a rect annotation can be drawn, undone, and redone
    steps.annotateCanvas().then(($canvas) => {
      const r = $canvas[0].getBoundingClientRect();
      const at = (dx: number, dy: number) => ({
        clientX: Math.round(r.left + dx),
        clientY: Math.round(r.top + dy),
        pointerId: 1,
        isPrimary: true,
        button: 0,
        buttons: 1,
        force: true,
      });
      cy.wrap($canvas).trigger('pointerdown', at(10, 10)).trigger('pointermove', at(60, 40)).trigger('pointerup', at(60, 40));
    });
    steps.snipButton('undo').should('not.be.disabled');
    steps.snipButton('undo').click();
    steps.snipButton('redo').should('not.be.disabled');
    steps.snipButton('redo').click();
    // When the annotated capture is saved into the composer
    steps.snipButton('snip-save').click();
    asserts.pendingChipState('ready');
    steps.composer().type('screenshot thread');
    steps.composerSend().click();
    // Then the card carries the screenshot thumb
    asserts.attachmentThumbCount(1);
    // And its annotation can be re-opened, extended, and saved as a reply
    steps.annotationEditButtons().first().click();
    steps.snipModal().should('be.visible');
    steps.snipButton('undo').should('not.be.disabled');
    steps.snipTool('arrow').click();
    steps.annotateCanvas().then(($canvas) => {
      const r = $canvas[0].getBoundingClientRect();
      const at = (dx: number, dy: number) => ({
        clientX: Math.round(r.left + dx),
        clientY: Math.round(r.top + dy),
        pointerId: 1,
        isPrimary: true,
        button: 0,
        buttons: 1,
        force: true,
      });
      cy.wrap($canvas).trigger('pointerdown', at(80, 10)).trigger('pointermove', at(30, 60)).trigger('pointerup', at(30, 60));
    });
    steps.snipButton('snip-save').click();
    // The reply box opens with the edited screenshot as a chip
    steps.replyField().should('be.visible');
    asserts.replyChipState('ready');
    steps.replyField().type('see the arrow');
    steps.replySend().click();
    // And the reply carries both thumbnails (original + edited)
    asserts.attachmentThumbCount(2);
  });

  it('falls back to a notice when screen capture is denied', () => {
    openComposer();
    // When getDisplayMedia rejects (permission denied / unsupported)
    cy.window().then((win) => {
      const media = win.navigator.mediaDevices;
      if (media) media.getDisplayMedia = () => Promise.reject(new win.DOMException('denied', 'NotAllowedError'));
    });
    steps.screenCaptureButton().click();
    // Then the notice explains and the composer stays usable
    steps.notice().should('be.visible').and('contain', 'capture');
  });
});

// ---------------------------------------------------------------------------
// Realtime (phase 5) + rail polish — driven through MemoryDataSource.emitRealtime,
// the exact merge path the live phoenix transport feeds (no socket needed).
// ---------------------------------------------------------------------------

describe('noizu-page-comments realtime + polish', () => {
  const THREAD_ID = 'demo-1';

  beforeEach(() => {
    steps.visit(Cypress.env('COMPONENT_PATH') || '/demo/page-comments.html');
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    steps.enable();
    steps.rail().should('be.visible');
  });

  const replyOnCard = (): void => {
    steps.card(THREAD_ID).find('[data-cy="comments.reply"]').click();
    steps.card(THREAD_ID).find('[data-cy="comments.reply-field"]').type('own reply');
    steps.card(THREAD_ID).find('[data-cy="comments.reply-send"]').click();
  };

  it('merges incoming realtime events idempotently and dots the thread', () => {
    // When another user's comment arrives over realtime
    steps.emitRealtime({type: 'comment_created', threadId: THREAD_ID, comment: {id: 'rt-1', thread_id: THREAD_ID, body_md: 'live reply'}});
    // Then the card renders it once, with an unread dot counting one event
    steps.card(THREAD_ID).contains('live reply').should('exist');
    steps.unreadDot(THREAD_ID).should('exist').and('have.attr', 'data-count', '1');
    // And replaying the identical event neither duplicates nor re-counts
    steps.emitRealtime({type: 'comment_created', threadId: THREAD_ID, comment: {id: 'rt-1', thread_id: THREAD_ID, body_md: 'live reply'}});
    cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.card"] [data-comment-id="rt-1"]').should('have.length', 1);
    steps.unreadDot(THREAD_ID).should('have.attr', 'data-count', '1');
  });

  it('clears the unread dot when the thread is focused', () => {
    steps.emitRealtime({type: 'comment_created', threadId: THREAD_ID, comment: {id: 'rt-2', thread_id: THREAD_ID, body_md: 'another live reply'}});
    steps.unreadDot(THREAD_ID).should('exist');
    // When the card is clicked (focused) the thread counts as seen
    steps.card(THREAD_ID).click();
    steps.unreadDot(THREAD_ID).should('not.exist');
  });

  it('filters cards through the Open/Resolved/All tabs (default Open)', () => {
    // Default tab is Open and shows the unresolved seeded thread
    steps.tab('open').should('have.attr', 'aria-pressed', 'true');
    steps.card(THREAD_ID).should('exist');
    // When realtime resolves the thread it leaves the Open tab…
    steps.emitRealtime({type: 'thread_resolved', threadId: THREAD_ID});
    steps.card(THREAD_ID).should('not.exist');
    // …appears under Resolved with its badge…
    steps.tab('resolved').click();
    steps.card(THREAD_ID).should('exist');
    cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.resolved-badge"]').should('exist');
    // …and All lists everything
    steps.tab('all').click();
    steps.card(THREAD_ID).should('exist');
  });

  it('shows an "N new" pill for off-screen threads and focuses them on click', () => {
    // Bottom-drawer viewport stacks cards in a scrollable column, so later
    // cards sit below the fold — deterministic off-screen threads.
    // 420x560 → bottom drawer with a ~160px cards viewport; enough stacked
    // cards guarantees the last one is below the fold.
    cy.viewport(420, 560);
    const lowAnchor = {
      css: '#pc-demo-anchor',
      xpath: '',
      textQuote: {prefix: '', exact: 'Seeded anchor heading', suffix: ''},
      fingerprint: {tag: 'h2', textHash: '', relPos: 0},
    };
    cy.window().then((win) => {
      const demo = win as unknown as {__pcDemo: {source: {emitRealtime: (event: unknown) => void; store: Map<string, unknown>}}};
      // thread_created routes by its own page_key — compute it the way the
      // controller does (origin + pathname, trailing slash collapsed).
      const loc = win.location;
      const pageKey = loc.origin + (loc.pathname.replace(/\/+$/, '') || '/');
      for (const [n, id] of ['one', 'two', 'three', 'four', 'five', 'six'].entries()) {
        demo.__pcDemo.source.emitRealtime({
          type: 'thread_created',
          thread: {
            id: n === 5 ? 'rt-lower' : `rt-low-${id}`,
            page_key: pageKey,
            url: loc.href,
            anchor: lowAnchor,
            body_md: `low thread ${id}`,
            resolved: false,
            comments: [],
          },
        });
      }
    });
    // When an event lands on a thread whose card is off-screen
    steps.card('rt-lower').should('exist');
    steps.emitRealtime({type: 'comment_created', threadId: 'rt-lower', comment: {id: 'rt-3', thread_id: 'rt-lower', body_md: 'below the fold reply'}});
    // Then the header pill surfaces the count…
    steps.newPill().should('be.visible').and('contain', 'new');
    // …and clicking it focuses the first unseen thread (insertion order:
    // the first thread_created): ring on its anchor, its dot consumed…
    steps.newPill().click();
    asserts.ringAroundAnchor('rt-low-one');
    steps.unreadDot('rt-low-one').should('not.exist');
    // …while the remaining off-screen unreads keep the pill up.
    steps.newPill().should('be.visible');
  });

  it('does not let an echo of this client own write clobber the rail', () => {
    replyOnCard();
    cy.window().then((win) => {
      const demo = (win as unknown as {
        __pcDemo: {source: {store: Map<string, {id: string; comments: {id: string; body_md: string}[]}>}};
      }).__pcDemo;
      const thread = demo.source.store.get(THREAD_ID)!;
      const own = thread.comments[thread.comments.length - 1];
      // When the realtime echo of that own write arrives with stale content
      demo.source.emitRealtime({
        type: 'comment_updated',
        threadId: THREAD_ID,
        comment: {id: own.id, thread_id: THREAD_ID, body_md: 'ECHO CLOBBER'},
      });
    });
    // Then the local state is neither duplicated nor clobbered
    cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.card"]').contains('own reply').should('exist');
    cy.get('noizu-page-comments-rail').shadow().find('[data-cy="comments.card"]').contains('ECHO CLOBBER').should('not.exist');
    steps.unreadDot(THREAD_ID).should('not.exist');
  });
});

// ---------------------------------------------------------------------------
// Text-anchor flow: select → pill → composer (quote preview) → post →
// per-line rings → reload re-anchor → orphan on edit.
// ---------------------------------------------------------------------------

describe('noizu-page-comments text-anchor flow', () => {
  const LONG = '#pc-demo-long';

  beforeEach(() => {
    steps.visit(Cypress.env('COMPONENT_PATH') || '/demo/page-comments.html');
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    steps.enable();
    steps.rail().should('be.visible');
  });

  it('shows the Comment pill on a text selection and posts a thread with the quote', () => {
    // When text is selected the pill appears at the selection end…
    steps.selectTextRange(LONG, 0, 4);
    steps.selectionPill().should('be.visible');
    // …and using it never collapses the selection (pointerdown prevented).
    cy.window().then((win) => {
      expect(win.document.getSelection()!.isCollapsed, 'selection survives the pill').to.be.false;
    });
    // When the pill is clicked the composer opens with the quoted excerpt
    steps.selectionPill().click();
    steps.composerCard().should('be.visible');
    steps.composerCard().find('.excerpt').should('contain', 'wrapping paragraph');
    steps.composer().type('pill-posted thread');
    steps.composerSend().click();
    // Then the card shows the same quote as its excerpt
    steps.card().contains('pill-posted thread').should('exist');
    cy.get('noizu-page-comments-rail')
      .shadow()
      .find('[data-cy="comments.card"]')
      .contains('pill-posted thread')
      .parents('[data-cy="comments.card"]')
      .find('.excerpt')
      .should('contain', 'wrapping paragraph');
  });

  it('comments on the selection via the + Comment button without entering pick mode', () => {
    steps.selectTextRange(LONG, 0, 5);
    steps.pickButton().click();
    // The composer opens directly on the selection — no pick round trip.
    steps.composerCard().should('be.visible');
    steps.pickButton().should('not.have.attr', 'aria-pressed');
    steps.composerCard().find('.excerpt').should('contain', 'Long wrapping paragraph');
  });

  it('comments on the selection via Alt+Shift+C', () => {
    steps.selectTextRange(LONG, 2, 7);
    steps.pressAltShiftC();
    steps.composerCard().should('be.visible');
    steps.composer().type('shortcut thread');
    steps.composerSend().click();
    steps.card().contains('shortcut thread').should('exist');
  });

  it('dismisses the pill on Escape and keeps the page clean', () => {
    steps.selectTextRange(LONG, 0, 4);
    steps.selectionPill().should('be.visible');
    cy.get('body').type('{esc}');
    steps.selectionPill().should('not.exist');
    steps.composerCard().should('not.exist');
  });

  it('draws one ring per line for a multi-line selection', () => {
    steps.selectTextRange(LONG, 0, 60);
    steps.selectionPill().should('be.visible');
    steps.selectionPill().click();
    steps.composer().type('multi-line thread');
    steps.composerSend().click();
    // The freshly created thread is focused, so its ring renders — one
    // segment per line rect, not one box around the whole paragraph. The
    // expected count is the rect count of a range over the same words (the
    // stored quote trims edge whitespace, so a selectNodeContents range
    // would overcount).
    steps.wordRange(LONG, 0, 60).then((quoteRange) => {
      const expected = Math.min((quoteRange as Range).getClientRects().length, 40);
      expect(expected, 'fixture paragraph wraps to multiple lines').to.be.greaterThan(1);
      cy.get('noizu-page-comments-overlay')
        .shadow()
        .find('[data-cy="comments.ring"]')
        .should('have.length', expected);
    });
  });

  it('re-anchors the exact words after a reload', () => {
    // Words spanning several wrapped lines: the re-anchored ring must come
    // back as line segments, not a single box.
    steps.selectTextRange(LONG, 0, 30);
    steps.selectionPill().should('be.visible');
    steps.selectionPill().click();
    steps.composer().type('reload survival');
    steps.composerSend().click();
    steps.storedThread('reload survival');
    // Fresh page = fresh resolve: reload, then feed the stored anchor back
    // through the same path a page-load thread fetch uses.
    cy.reload();
    steps.waitDefined();
    steps.enable();
    steps.rail().should('be.visible');
    cy.get('@storedThread').then((stored) => {
      cy.window().then((win) => {
        const loc = win.location;
        const key = loc.origin + (loc.pathname.replace(/\/+$/, '') || '/');
        steps.emitRealtime({
          type: 'thread_created',
          thread: {
            id: 'rt-reanchor',
            page_key: key,
            url: loc.href,
            anchor: (stored as unknown as {anchor: unknown}).anchor,
            body_md: 'reload survival',
            resolved: false,
            comments: [],
          },
        });
      });
    });
    steps.card('rt-reanchor').should('exist');
    steps.card('rt-reanchor').click();
    asserts.ringAroundAnchor('rt-reanchor');
    // The ring hugs the quoted lines: several line-height segments, never a
    // single box around the containing element.
    cy.get('noizu-page-comments-overlay')
      .shadow()
      .find('[data-cy="comments.ring"][data-thread-id="rt-reanchor"]')
      .then(($rings) => {
        expect($rings.length, 'per-line ring segments').to.be.greaterThan(1);
      });
    cy.window().then((win) => {
      const elementHeight = win.document.querySelector(LONG)!.getBoundingClientRect().height;
      cy.get('noizu-page-comments-overlay')
        .shadow()
        .find('[data-cy="comments.ring"][data-thread-id="rt-reanchor"]')
        .then(($rings) => {
          const tallest = Math.max(...[...$rings].map((r) => (r as HTMLElement).getBoundingClientRect().height));
          expect(tallest, 'rings are line-sized, not element-sized').to.be.lessThan(elementHeight / 2);
        });
    });
  });

  it('orphans a range thread when its quoted text is edited away', () => {
    steps.selectTextRange(LONG, 0, 6);
    steps.selectionPill().click();
    steps.composer().type('orphan me');
    steps.composerSend().click();
    steps.storedThread('orphan me');
    // When the quoted words are replaced (container element survives, quote
    // does not) the range anchor must orphan, not widen to the element.
    cy.get('@storedThread').then((stored) => {
      cy.window().then((win) => {
        (win.document.querySelector(LONG) as HTMLElement).textContent =
          'Replacement prose sharing none of the originally quoted words.';
      });
      asserts.orphaned((stored as unknown as {id: string}).id);
    });
  });
});
