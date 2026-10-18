/** Dispatch a bubbling, composed CustomEvent from a host. */
export function emit(host: EventTarget, name: string, detail: unknown): boolean {
  return host.dispatchEvent(
    new CustomEvent(name, {detail, bubbles: true, composed: true}),
  );
}
