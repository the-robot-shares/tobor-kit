/**
 * Shared a11y helpers for the page-comments modal layers (lightbox, snip
 * editor): a shadow-DOM-aware focus trap and open/close focus bookkeeping.
 */

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab (and Shift+Tab) inside `root`'s shadow tree. Call from the
 * host-level keydown handler; falls back to the root itself when nothing
 * focusable renders.
 */
export function trapFocus(root: DocumentFragment | HTMLElement, event: KeyboardEvent): void {
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
  const target = event.composedPath()[0];
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const currentIndex = focusable.indexOf(target as HTMLElement);
  if (event.shiftKey) {
    event.preventDefault();
    const next = currentIndex <= 0 ? last : focusable[currentIndex - 1];
    next.focus();
  } else {
    event.preventDefault();
    const next = currentIndex === -1 || currentIndex === focusable.length - 1 ? first : focusable[currentIndex + 1];
    next.focus();
  }
}

/** Modal open/close focus bookkeeping: stash the trigger, restore on close. */
export class FocusKeeper {
  private previous: HTMLElement | null = null;

  capture(): void {
    this.previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  /** Restore focus to the stashed trigger and forget it. */
  restore(): void {
    this.previous?.focus();
    this.previous = null;
  }
}
