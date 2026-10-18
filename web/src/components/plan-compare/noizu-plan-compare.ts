import {LitElement, html, css, nothing} from 'lit';
import {property, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {
  formatPrice,
  interpolateCheckoutUrl,
  parsePlansJson,
  priceOf,
  type BillingInterval,
  type Plan,
  type PlanSelectDetail,
} from './plans.js';
import {defineElement} from '../../define.js';

export type {BillingInterval, Plan, PlanSelectDetail} from './plans.js';

/**
 * Data-driven plan comparison island. Emits `plan-select`; the host owns
 * Stripe Payment Links and navigation. No in-kit checkout, no Stripe keys.
 */
@defineElement('noizu-plan-compare')
export class NoizuPlanCompare extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      [data-cy='plan.compare'] {
        display: grid;
        gap: var(--_gap);
      }

      .cards {
        display: grid;
        gap: var(--_gap);
        grid-template-columns: repeat(auto-fit, minmax(var(--tobor-kit-plan-min, 16rem), 1fr));
      }

      .card {
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 16px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      .card[data-highlighted] {
        border-color: var(--_accent);
        box-shadow: var(--_shadow);
      }

      .name {
        margin: 0;
        font-size: 1.15rem;
      }

      .badge {
        justify-self: start;
        font-size: 0.75rem;
        color: var(--_accent-fg);
        background: var(--_accent);
        border-radius: calc(var(--_radius) / 2);
        padding: 2px 8px;
      }

      .price {
        font-size: 1.5rem;
        font-weight: 650;
      }

      .features {
        margin: 0;
        padding-left: 1.15rem;
        color: var(--_muted);
      }

      .cta[data-highlighted] {
        background: var(--_accent);
        color: var(--_accent-fg);
        border-color: var(--_accent);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        overflow: hidden;
      }

      th,
      td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--_border);
        text-align: center;
      }

      th:first-child,
      td:first-child {
        text-align: left;
        color: var(--_muted);
      }

      caption {
        text-align: left;
        padding: 0 0 8px;
        color: var(--_muted);
      }
    `,
  ];

  @property({attribute: false})
  plans: Plan[] = [];

  @property({reflect: true})
  layout: 'cards' | 'table' = 'cards';

  @property({type: Boolean, reflect: true, attribute: 'billing-toggle'})
  billingToggle = false;

  @property({attribute: 'checkout-url-template'})
  checkoutUrlTemplate = '';

  @state()
  private interval: BillingInterval = 'monthly';

  private observer?: MutationObserver;

  override connectedCallback() {
    super.connectedCallback();
    this.hydrateFromScript();
    this.observer ??= new MutationObserver(() => this.hydrateFromScript());
    this.observer.observe(this, {childList: true, subtree: true, characterData: true});
  }

  override disconnectedCallback() {
    this.observer?.disconnect();
    super.disconnectedCallback();
  }

  protected override firstUpdated() {
    this.hydrateFromScript();
  }

  override render() {
    const table = this.layout === 'table';
    return html`
      <div part="compare" data-cy="plan.compare" data-layout=${table ? 'table' : 'cards'}>
        ${this.billingToggle ? this.renderToggle() : nothing}
        ${table ? this.renderTable() : this.renderCards()}
      </div>
    `;
  }

  private renderToggle() {
    const yearly = this.interval === 'yearly';
    return html`
      <button
        type="button"
        part="toggle"
        data-cy="plan.toggle"
        role="switch"
        aria-checked=${yearly ? 'true' : 'false'}
        aria-label="Bill yearly"
        @click=${this.onToggle}
      >
        ${yearly ? 'Yearly' : 'Monthly'}
      </button>
    `;
  }

  private renderCards() {
    return html`
      <div class="cards">
        ${this.plans.map((plan) => {
          const highlighted = plan.highlighted === true;
          const amount = priceOf(plan, this.interval);
          return html`
            <article
              class=${classMap({card: true})}
              part="card"
              data-cy="plan.card"
              data-plan-id=${plan.id}
              ?data-highlighted=${highlighted}
            >
              ${highlighted ? html`<span class="badge">Popular</span>` : nothing}
              <h2 class="name" part="name">${plan.name}</h2>
              <div class="price" part="price" data-interval=${this.interval} data-amount=${String(amount)}>
                ${formatPrice(amount, this.interval)}
              </div>
              <ul class="features" part="features">
                ${plan.features.map((feature) => html`<li>${feature}</li>`)}
              </ul>
              ${this.renderCta(plan, highlighted)}
            </article>
          `;
        })}
      </div>
    `;
  }

  private renderTable() {
    const features = this.featureUnion();
    return html`
      <table part="table">
        <caption>Plan comparison</caption>
        <thead>
          <tr>
            <th scope="col"></th>
            ${this.plans.map((plan) => {
              const amount = priceOf(plan, this.interval);
              return html`
                <th
                  scope="col"
                  part="card"
                  data-cy="plan.card"
                  data-plan-id=${plan.id}
                  ?data-highlighted=${plan.highlighted === true}
                >
                  <div class="name" part="name">${plan.name}</div>
                  <div class="price" part="price" data-interval=${this.interval} data-amount=${String(amount)}>
                    ${formatPrice(amount, this.interval)}
                  </div>
                </th>
              `;
            })}
          </tr>
        </thead>
        <tbody>
          ${features.map(
            (feature) => html`
              <tr>
                <th scope="row">${feature}</th>
                ${this.plans.map(
                  (plan) => html`<td>${plan.features.includes(feature) ? 'Yes' : '—'}</td>`,
                )}
              </tr>
            `,
          )}
          <tr>
            <th scope="row"></th>
            ${this.plans.map((plan) => html`<td>${this.renderCta(plan, plan.highlighted === true)}</td>`)}
          </tr>
        </tbody>
      </table>
    `;
  }

  private renderCta(plan: Plan, highlighted: boolean) {
    return html`
      <button
        type="button"
        class=${classMap({cta: true})}
        part="cta"
        data-cy="plan.cta"
        data-plan-id=${plan.id}
        ?data-highlighted=${highlighted}
        @click=${() => this.onSelect(plan)}
      >
        ${plan.ctaLabel || 'Choose plan'}
      </button>
    `;
  }

  private featureUnion(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const plan of this.plans) {
      for (const feature of plan.features) {
        if (seen.has(feature)) continue;
        seen.add(feature);
        out.push(feature);
      }
    }
    return out;
  }

  private hydrateFromScript() {
    if (this.plans.length) return;
    const script = this.querySelector('script[type="application/json"]');
    if (!script) return;
    const parsed = parsePlansJson(script.textContent ?? '');
    if (parsed.length) this.plans = parsed;
  }

  private readonly onToggle = () => {
    this.interval = this.interval === 'monthly' ? 'yearly' : 'monthly';
  };

  private onSelect(plan: Plan) {
    const detail: PlanSelectDetail = {
      planId: plan.id,
      checkoutUrl: interpolateCheckoutUrl(this.checkoutUrlTemplate, plan.id),
      interval: this.billingToggle ? this.interval : 'monthly',
    };
    emit(this, 'plan-select', detail);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-plan-compare': NoizuPlanCompare;
  }
  interface HTMLElementEventMap {
    'plan-select': CustomEvent<PlanSelectDetail>;
  }
}
