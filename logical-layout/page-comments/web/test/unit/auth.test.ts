import {expect, aTimeout} from "@open-wc/testing";
import {AnnotateAuth} from "../../auth.js";

describe("AnnotateAuth popup handling", () => {
  const API_BASE = "https://annotate.test";
  const originalOpen = window.open;

  afterEach(() => {
    window.open = originalOpen;
  });

  function make(): {auth: AnnotateAuth; errors: (string | null)[]} {
    const errors: (string | null)[] = [];
    const auth = new AnnotateAuth({
      apiBase: API_BASE,
      site: "unit",
      onStateChange: (state) => errors.push(state.error),
    });
    return {auth, errors};
  }

  it("keeps the opener relationship (no noopener) so postMessage works", () => {
    let features = "";
    window.open = ((_url: string | URL, _target?: string, f?: string) => {
      features = f ?? "";
      return null;
    }) as typeof window.open;
    const {auth} = make();
    auth.signIn();
    expect(features).to.not.contain("noopener");
    auth.dispose();
  });

  it("surfaces popup-blocked instead of failing silently", () => {
    window.open = (() => null) as typeof window.open;
    const {auth, errors} = make();
    auth.signIn();
    expect(auth.state.signedIn).to.equal(false);
    expect(auth.state.error).to.equal("popup-blocked");
    expect(errors.at(-1)).to.equal("popup-blocked");
    auth.dispose();
  });

  it("drops the message listener once a closed popup is polled", async () => {
    const fake = {closed: false, close: () => {}} as unknown as Window;
    window.open = (() => fake) as typeof window.open;
    const {auth} = make();
    auth.signIn();
    expect(auth.state.error).to.equal(null);
    // User closes the popup without finishing sign-in; the 500ms poll must
    // remove the listener, so a later handback message does nothing.
    (fake as unknown as {closed: boolean}).closed = true;
    await aTimeout(700);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: API_BASE,
        data: {type: "annotate-auth", access_token: "leaked"},
      }),
    );
    await aTimeout(20);
    expect(auth.state.signedIn).to.equal(false);
    expect(auth.accessToken).to.be.undefined;
    auth.dispose();
  });

  it("dispose closes a live popup", () => {
    let closedCount = 0;
    const fake = {closed: false, close: () => closedCount++} as unknown as Window;
    window.open = (() => fake) as typeof window.open;
    const {auth} = make();
    auth.signIn();
    auth.dispose();
    expect(closedCount).to.equal(1);
  });
});
