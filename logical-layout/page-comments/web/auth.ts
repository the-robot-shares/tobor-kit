/**
 * Auth client stub for `<noizu-page-comments>` — popup sign-in against the
 * annotate service's embed login, postMessage handback, in-memory tokens.
 *
 * Flow: "Sign in" opens `${apiBase}/embed/login?site=<site>&origin=<here>`.
 * The popup completes the host IdP dance server-side and postMessages back:
 *
 *   { type: 'annotate-auth', access_token, expires_at, refresh_token? }
 *   { type: 'annotate-auth-error', error }
 *
 * Only messages whose `event.origin` equals the api-base origin are trusted.
 * A blocked popup (null from `window.open`) surfaces as a `popup-blocked`
 * auth error, and a popup the user closes without finishing sign-in drops
 * its message listener via a `popup.closed` poll. Tokens live in memory
 * only — never localStorage, never a cookie the widget sets. A refresh
 * timer calls `POST /api/v1/token/refresh` a minute before expiry when a
 * refresh token was issued.
 */

export interface AnnotateAuthTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface AnnotateAuthState {
  signedIn: boolean;
  tokens: AnnotateAuthTokens | null;
  error: string | null;
}

export interface AnnotateAuthOptions {
  apiBase: string;
  site: string;
  onStateChange?: (state: AnnotateAuthState) => void;
  fetch?: typeof fetch;
}

const REFRESH_LEAD_MS = 60_000;

export class AnnotateAuth {
  private readonly apiBase: string;
  private readonly site: string;
  private readonly onStateChange: (state: AnnotateAuthState) => void;
  private readonly fetchImpl: typeof fetch;
  private tokens: AnnotateAuthTokens | null = null;
  private lastError: string | null = null;
  private popup: Window | null = null;
  private popupPoll: number | null = null;
  private refreshTimer: number | null = null;
  private listener: ((event: MessageEvent) => void) | null = null;

  constructor(options: AnnotateAuthOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.site = options.site;
    this.onStateChange = options.onStateChange ?? (() => {});
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
  }

  get state(): AnnotateAuthState {
    return {signedIn: this.tokens !== null, tokens: this.tokens, error: this.lastError};
  }

  get accessToken(): string | undefined {
    return this.tokens?.accessToken;
  }

  /** Origin the postMessage handback must come from. */
  get expectedOrigin(): string {
    return new URL(this.apiBase).origin;
  }

  signIn(): void {
    this.lastError = null;
    this.emit();
    // Release a stale listener from a previous popup before opening a new one.
    this.stopListening();
    this.clearPopupPoll();
    this.listener = (event: MessageEvent) => this.onMessage(event);
    window.addEventListener("message", this.listener);
    const target = `${this.apiBase}/embed/login?site=${encodeURIComponent(this.site)}&origin=${encodeURIComponent(location.origin)}`;
    // Deliberately NO "noopener": the popup needs `window.opener` to
    // postMessage the tokens back, and we need the handle to detect a
    // blocked or closed popup.
    this.popup = window.open(target, "annotate-login", "width=460,height=640");
    if (!this.popup) {
      // Popup blocked: surface it instead of failing silently.
      this.stopListening();
      this.lastError = "popup-blocked";
      this.emit();
      return;
    }
    // User closed the popup without completing sign-in: drop the listener.
    this.popupPoll = window.setInterval(() => {
      if (this.popup?.closed) {
        this.popup = null;
        this.clearPopupPoll();
        this.stopListening();
      }
    }, 500);
  }

  signOut(): void {
    this.tokens = null;
    this.lastError = null;
    this.clearRefresh();
    this.clearPopupPoll();
    this.stopListening();
    this.emit();
  }

  dispose(): void {
    this.clearRefresh();
    this.clearPopupPoll();
    this.stopListening();
    this.popup?.close();
    this.popup = null;
  }

  private stopListening(): void {
    if (this.listener) window.removeEventListener("message", this.listener);
    this.listener = null;
  }

  private clearPopupPoll(): void {
    if (this.popupPoll !== null) window.clearInterval(this.popupPoll);
    this.popupPoll = null;
  }

  private onMessage(event: MessageEvent): void {
    if (event.origin !== this.expectedOrigin) return;
    const data = event.data as {type?: string; access_token?: string; expires_at?: number; refresh_token?: string; error?: string} | null;
    if (!data || typeof data !== "object") return;
    if (data.type === "annotate-auth" && data.access_token) {
      this.tokens = {
        accessToken: data.access_token,
        expiresAt: data.expires_at ?? Date.now() + 15 * 60_000,
        refreshToken: data.refresh_token,
      };
      this.lastError = null;
      this.stopListening();
      this.clearPopupPoll();
      this.popup?.close();
      this.popup = null;
      this.emit();
      this.scheduleRefresh();
    } else if (data.type === "annotate-auth-error") {
      this.lastError = data.error ?? "sign-in-failed";
      this.stopListening();
      this.clearPopupPoll();
      this.popup?.close();
      this.popup = null;
      this.emit();
    }
  }

  private scheduleRefresh(): void {
    this.clearRefresh();
    if (!this.tokens?.refreshToken) return;
    const wait = Math.max(5_000, this.tokens.expiresAt - Date.now() - REFRESH_LEAD_MS);
    this.refreshTimer = window.setTimeout(() => {
      void this.refreshNow();
    }, wait);
  }

  private clearRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  /** POST /api/v1/token/refresh — swapped in before expiry; failure signs out. */
  private async refreshNow(): Promise<void> {
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken) return;
    try {
      const response = await this.fetchImpl(`${this.apiBase}/api/v1/token/refresh`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {Authorization: `Bearer ${refreshToken}`, "Content-Type": "application/json"},
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {access_token?: string; expires_at?: number; refresh_token?: string};
      if (!body.access_token) throw new Error("missing access_token");
      this.tokens = {
        accessToken: body.access_token,
        expiresAt: body.expires_at ?? Date.now() + 15 * 60_000,
        refreshToken: body.refresh_token ?? refreshToken,
      };
      this.emit();
      this.scheduleRefresh();
    } catch {
      this.tokens = null;
      this.lastError = "refresh-failed";
      this.emit();
    }
  }

  private emit(): void {
    this.onStateChange(this.state);
  }
}
