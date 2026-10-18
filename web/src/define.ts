/**
 * Idempotent, SSR-safe custom-element registration for every kit element.
 *
 * Lit's `@customElement` calls `customElements.define` unconditionally, so a
 * page that loads the kit twice (two CDN shas, npm bundle + CDN island, a
 * hot-reloaded chunk) throws `NotSupportedError` on the second copy and the
 * whole module import rejects. It also assumes a `customElements` global,
 * which a no-DOM server render does not have.
 *
 * `defineElement` keeps the decorator ergonomics and registers exactly once:
 * the first definition of a tag wins, later copies are skipped with a
 * console warning (a double load is worth knowing about), and without a
 * registry (SSR, workers, plain Node) nothing happens. The call runs at module
 * evaluation, so importing any component entry — npm subpath or CDN
 * `components/<family>/<element>.js` — registers its tag. The package's
 * `sideEffects` list keeps those modules from being tree-shaken.
 */

type Registry = Pick<CustomElementRegistry, "get" | "define">;

/** Register `ctor` as `tag` unless the tag is taken or there is no registry. */
export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
  const registry = (globalThis as {customElements?: Registry}).customElements;
  if (!registry) return;
  const existing = registry.get(tag);
  if (existing) {
    // Another copy of the kit got here first; its class keeps the tag. Say so,
    // because this copy's fixes will not run for <tag> on this page.
    if (existing !== ctor) console.warn(`[tobor-kit] <${tag}> is already defined by another copy of the kit; this copy's definition was skipped.`);
    return;
  }
  registry.define(tag, ctor);
}

/**
 * Class decorator: `@defineElement('noizu-auth')`. Works with the legacy
 * (experimentalDecorators) and the standard decorator protocols, like Lit's
 * own `customElement`.
 */
export const defineElement =
  (tag: string) =>
  (ctor: CustomElementConstructor, context?: {addInitializer(fn: () => void): void}): void => {
    if (context !== undefined) context.addInitializer(() => defineOnce(tag, ctor));
    else defineOnce(tag, ctor);
  };
