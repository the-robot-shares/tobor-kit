import {LitElement, html, css, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {emit} from '../../events.js';
import {defineElement} from '../../define.js';

export type BillingStatusKind =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'complimentary'
  | string;

/** Host-owned subscription snapshot. Never a Stripe object or secret. */
export interface BillingSubscription {
  status: BillingStatusKind;
  trialEndsAt?: string;
  renewsAt?: string;
  complimentary?: boolean;
  planName?: string;
}

export type PortalOpenDetail = Record<string, never>;

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
  complimentary: 'Complimentary',
};

function resolvedKind(sub?: BillingSubscription): string {
  if (!sub) return '';
  if (sub.complimentary || sub.status === 'complimentary') return 'complimentary';
  return sub.status;
}

function statusLabel(kind: string): string {
  if (!kind) return 'No subscription';
  if (STATUS_LABEL[kind]) return STATUS_LABEL[kind];
  const spaced = kind.replace(/_/g, ' ').trim();
  return spaced ? spaced.replace(/^\w/, (c) => c.toUpperCase()) : 'No subscription';
}

/** ISO timestamps collapse to YYYY-MM-DD so unit tests are timezone-stable. */
export function formatBillingDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return trimmed;
  return new Date(ms).toISOString().slice(0, 10);
}

function dateLine(sub?: BillingSubscription): string {
  if (!sub) return '';
  const parts: string[] = [];
  if (sub.trialEndsAt) parts.push(`Trial ends ${formatBillingDate(sub.trialEndsAt)}`);
  if (sub.renewsAt) parts.push(`Renews ${formatBillingDate(sub.renewsAt)}`);
  return parts.join(' · ');
}

/** Shadow-DOM billing status row. Host opens the Stripe customer portal. */
@defineElement('noizu-billing-status')
export class NoizuBillingStatus extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--_gap);
      }

      .status[data-kind='past_due'] {
        color: var(--_danger);
      }

      .status[data-kind='trialing'] {
        color: var(--_warn);
      }

      .status[data-kind='canceled'] {
        color: var(--_muted);
      }

      .plan,
      .dates {
        color: var(--_muted);
        font-size: 0.85em;
      }
    `,
  ];

  /** Host-supplied snapshot. JS property only — not an HTML attribute. */
  @property({attribute: false})
  subscription?: BillingSubscription;

  override render() {
    const kind = resolvedKind(this.subscription);
    const plan = this.subscription?.planName?.trim() ?? '';
    const dates = dateLine(this.subscription);
    return html`
      <div class="row" part="row">
        <span class="status" part="status" data-cy="billing.status" data-kind=${kind || nothing}>
          ${statusLabel(kind)}
        </span>
        ${plan
          ? html`<span class="plan" part="plan" data-cy="billing.plan">${plan}</span>`
          : nothing}
        ${dates ? html`<span class="dates" part="dates">${dates}</span>` : nothing}
        <button
          type="button"
          part="portal"
          data-cy="billing.portal"
          @click=${this.onPortal}
        >
          Manage billing
        </button>
      </div>
    `;
  }

  private readonly onPortal = () => {
    emit<PortalOpenDetail>(this, 'portal-open', {});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-billing-status': NoizuBillingStatus;
  }
}
