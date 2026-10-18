import {LitElement, html, css, nothing} from 'lit';
import type {PropertyValues} from 'lit';
import {property, state} from 'lit/decorators.js';
import {emit} from '../../events.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export type HumanVerifyProvider = 'turnstile' | 'recaptcha-v3' | 'none';

/** Payload of the `verified` event. Not proof — host must siteverify. */
export interface HumanVerifyDetail {
  provider: HumanVerifyProvider;
  token: string;
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

type RecaptchaApi = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: {action: string}) => Promise<string>;
};

function turnstileApi(): TurnstileApi | undefined {
  return (globalThis as unknown as {turnstile?: TurnstileApi}).turnstile;
}

function recaptchaApi(): RecaptchaApi | undefined {
  return (globalThis as unknown as {grecaptcha?: RecaptchaApi}).grecaptcha;
}

function recaptchaSrc(siteKey: string): string {
  return `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
}

const scriptLoads = new Map<string, Promise<void>>();

function waitUntil(ready: () => boolean, timeout = 8000): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (ready()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error('Provider script did not initialize'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  const cached = scriptLoads.get(src);
  if (cached) return cached.then(() => waitUntil(ready));
  const promise = new Promise<void>((resolve, reject) => {
    const found = [...document.scripts].find((s) => {
      const attr = s.getAttribute('src') ?? '';
      return attr === src || s.src === src;
    });
    if (found) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => resolve(), {once: true});
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {once: true});
    document.head.append(script);
  })
    .then(() => waitUntil(ready))
    .catch((err: unknown) => {
      scriptLoads.delete(src);
      throw err;
    });
  scriptLoads.set(src, promise);
  return promise;
}

function asProvider(value: string): HumanVerifyProvider {
  const v = value.trim().toLowerCase();
  if (v === 'turnstile' || v === 'recaptcha-v3') return v;
  return 'none';
}

/**
 * Human-verification island. Emits `verified` `{provider, token}`.
 * Host MUST POST the token to Turnstile / reCAPTCHA siteverify — never treat
 * the event as proof. `site-key` is the PUBLIC site key only.
 */
@defineElement('noizu-human-verify')
export class NoizuHumanVerify extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
      }
      [part='root'] {
        display: grid;
        gap: var(--_gap);
      }
      [part='widget'] {
        min-height: 0;
      }
      [part='status'] {
        margin: 0;
        color: var(--_muted);
        font-size: 0.85em;
      }
    `,
  ];

  @property({reflect: true})
  provider = 'none';

  @property({attribute: 'site-key', reflect: true})
  siteKey = '';

  @property({reflect: true})
  action = 'signup';

  @state()
  private status = '';

  private boot = 0;
  private widgetId: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this.start();
  }

  override disconnectedCallback() {
    this.boot += 1;
    this.destroyWidget();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('provider') || changed.has('siteKey') || changed.has('action')) {
      this.start();
    }
  }

  /** Re-run the provider. `none` re-emits; turnstile resets; reCAPTCHA v3 executes again. */
  reset(): void {
    const provider = asProvider(this.provider);
    if (provider === 'turnstile' && this.widgetId) {
      try {
        turnstileApi()?.reset(this.widgetId);
        return;
      } catch {
        /* remount */
      }
    }
    this.start();
  }

  override render() {
    const provider = asProvider(this.provider);
    const label = provider === 'none' ? 'Human verification skipped' : 'Human verification';
    return html`
      <div part="root" data-cy="verify.root" aria-label=${label}>
        <div part="widget" data-cy="verify.widget"></div>
        ${this.status
          ? html`<p part="status" role="status" aria-live="polite">${this.status}</p>`
          : nothing}
      </div>
    `;
  }

  private start(): void {
    const boot = ++this.boot;
    this.destroyWidget();
    const provider = asProvider(this.provider);
    const action = this.action.trim() || 'signup';
    const siteKey = this.siteKey.trim();
    this.status = '';
    if (provider === 'none') {
      emit<HumanVerifyDetail>(this, 'verified', {provider: 'none', token: ''});
      return;
    }
    if (!siteKey) {
      this.status = 'Public site-key required.';
      return;
    }
    void this.mount(provider, siteKey, action, boot);
  }

  private async mount(
    provider: 'turnstile' | 'recaptcha-v3',
    siteKey: string,
    action: string,
    boot: number,
  ): Promise<void> {
    try {
      if (provider === 'turnstile') {
        await loadScript(TURNSTILE_SRC, () => Boolean(turnstileApi()));
        if (boot !== this.boot) return;
        await this.updateComplete;
        if (boot !== this.boot) return;
        const host = this.widgetHost();
        const api = turnstileApi();
        if (!host || !api) {
          this.status = 'Turnstile failed to load.';
          return;
        }
        this.widgetId = api.render(host, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            if (boot !== this.boot) return;
            emit<HumanVerifyDetail>(this, 'verified', {provider: 'turnstile', token});
          },
          'error-callback': () => {
            if (boot !== this.boot) return;
            this.status = 'Turnstile could not verify this session.';
          },
        });
        return;
      }
      await loadScript(recaptchaSrc(siteKey), () => Boolean(recaptchaApi()));
      if (boot !== this.boot) return;
      const grecaptcha = recaptchaApi();
      if (!grecaptcha) {
        this.status = 'reCAPTCHA failed to load.';
        return;
      }
      await new Promise<void>((resolve) => {
        grecaptcha.ready(() => resolve());
      });
      if (boot !== this.boot) return;
      const token = await grecaptcha.execute(siteKey, {action});
      if (boot !== this.boot) return;
      emit<HumanVerifyDetail>(this, 'verified', {provider: 'recaptcha-v3', token});
    } catch {
      if (boot !== this.boot) return;
      this.status = 'Verification widget failed to load.';
    }
  }

  private widgetHost(): HTMLElement | null {
    return this.renderRoot.querySelector('[data-cy="verify.widget"]');
  }

  private destroyWidget(): void {
    const id = this.widgetId;
    this.widgetId = null;
    if (!id) return;
    try {
      turnstileApi()?.remove(id);
    } catch {
      /* already gone */
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-human-verify': NoizuHumanVerify;
  }
}
