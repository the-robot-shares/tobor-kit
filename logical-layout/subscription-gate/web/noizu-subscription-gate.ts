import {LitElement, css, html, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export interface GateBlockedDetail {
  redirectTo: string;
}

const DEFAULT_REDIRECT_TO = '/pricing';

function isEntitledBody(body: unknown): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as {entitled?: unknown}).entitled === true
  );
}

/** Shadow-DOM entitled gate. Host owns entitlement truth and navigation. */
@defineElement('noizu-subscription-gate')
export class NoizuSubscriptionGate extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      [part='blocked'] {
        display: grid;
        gap: var(--_gap);
        padding: var(--_gap);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      [part='link'] {
        color: var(--_accent);
      }
    `,
  ];

  @property({type: Boolean, reflect: true})
  entitled = false;

  @property({attribute: 'check-url'})
  checkUrl = '';

  @property({attribute: 'redirect-to'})
  redirectTo = DEFAULT_REDIRECT_TO;

  @property({type: Boolean, attribute: 'auto-redirect'})
  autoRedirect = false;

  private generation = 0;
  private abort: AbortController | null = null;

  override connectedCallback() {
    super.connectedCallback();
    void this.evaluate();
  }

  override disconnectedCallback() {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('checkUrl') && changed.get('checkUrl') !== undefined) {
      void this.evaluate();
      return;
    }
    if (changed.has('entitled') && changed.get('entitled') === true && !this.entitled) {
      this.announceBlocked();
    }
  }

  override render() {
    const redirectTo = this.resolvedRedirect();
    return html`
      <div part="root" data-cy="gate.root">
        ${this.entitled
          ? html`<slot></slot>`
          : html`
              <div part="blocked" data-cy="gate.blocked" role="status">
                <p>This content requires a subscription.</p>
                <a part="link" data-cy="gate.link" href=${redirectTo}>Upgrade</a>
              </div>
            `}
      </div>
    `;
  }

  private resolvedRedirect(): string {
    const value = this.redirectTo.trim();
    return value || DEFAULT_REDIRECT_TO;
  }

  private async evaluate() {
    const gen = ++this.generation;
    if (!this.entitled && this.checkUrl.trim()) {
      await this.fetchEntitlement();
      if (gen !== this.generation || !this.isConnected) return;
    }
    if (!this.entitled) this.announceBlocked();
  }

  private async fetchEntitlement() {
    const url = this.checkUrl.trim();
    if (!url) return;
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {Accept: 'application/json'},
        signal: abort.signal,
      });
      if (res.status !== 200) return;
      const body: unknown = await res.json();
      if (isEntitledBody(body)) this.entitled = true;
    } catch {
      if (abort.signal.aborted) return;
    }
  }

  private announceBlocked() {
    const redirectTo = this.resolvedRedirect();
    const allowed = this.dispatchEvent(
      new CustomEvent<GateBlockedDetail>('gate-blocked', {
        detail: {redirectTo},
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    if (this.autoRedirect && allowed) {
      this.navigate(redirectTo);
    }
  }

  navigate(href: string): void {
    globalThis.location.assign(href);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-subscription-gate': NoizuSubscriptionGate;
  }
  interface HTMLElementEventMap {
    'gate-blocked': CustomEvent<GateBlockedDetail>;
  }
}
