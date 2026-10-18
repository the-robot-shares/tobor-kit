/**
 * Events-up helper. Every element in this kit reports upward with a composed,
 * bubbling CustomEvent whose `detail` is typed by the emitting element — the
 * host app never needs to reach into Shadow DOM.
 */
export function emit<T>(el: HTMLElement, name: string, detail: T): boolean {
  return el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
