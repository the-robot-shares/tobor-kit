import { expect } from "@open-wc/testing";
import { defineElement, defineOnce } from "../src/define.js";
import { NoizuAuth } from "../src/components/auth/noizu-auth.js";

describe("defineOnce / defineElement", () => {
  it("importing a component module registers its tag", () => {
    expect(customElements.get("noizu-auth")).to.equal(NoizuAuth);
  });

  it("a second definition of a taken tag is a no-op, not a throw", () => {
    class Impostor extends HTMLElement {}
    expect(() => defineOnce("noizu-auth", Impostor)).not.to.throw();
    expect(customElements.get("noizu-auth")).to.equal(NoizuAuth);
  });

  it("registers a new tag exactly once", () => {
    class First extends HTMLElement {}
    class Second extends HTMLElement {}
    defineOnce("tk-define-once-probe", First);
    defineOnce("tk-define-once-probe", Second);
    expect(customElements.get("tk-define-once-probe")).to.equal(First);
  });

  it("the decorator form registers under the legacy protocol", () => {
    class Decorated extends HTMLElement {}
    defineElement("tk-define-decorator-probe")(Decorated);
    expect(customElements.get("tk-define-decorator-probe")).to.equal(Decorated);
  });

  it("the decorator form defers to addInitializer under the standard protocol", () => {
    class Standard extends HTMLElement {}
    const initializers: Array<() => void> = [];
    defineElement("tk-define-standard-probe")(Standard, { addInitializer: (fn) => initializers.push(fn) });
    expect(customElements.get("tk-define-standard-probe")).to.equal(undefined);
    initializers.forEach((fn) => fn());
    expect(customElements.get("tk-define-standard-probe")).to.equal(Standard);
  });

  it("does nothing without a registry (SSR / no window)", () => {
    const registry = Object.getOwnPropertyDescriptor(globalThis, "customElements")
      ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(globalThis), "customElements");
    Object.defineProperty(globalThis, "customElements", { value: undefined, configurable: true });
    try {
      class Headless extends HTMLElement {}
      expect(() => defineOnce("tk-define-headless-probe", Headless)).not.to.throw();
    } finally {
      delete (globalThis as { customElements?: unknown }).customElements;
      if (registry && !("customElements" in globalThis)) Object.defineProperty(globalThis, "customElements", registry);
    }
    expect(customElements.get("tk-define-headless-probe")).to.equal(undefined);
  });
});
