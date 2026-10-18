import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export interface SgSpecRow {
  key: string;
  value: string;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

function asRows(value: unknown): SgSpecRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === 'object') {
      const rec = item as {key?: unknown; value?: unknown};
      return {key: cellText(rec.key), value: cellText(rec.value)};
    }
    return {key: '', value: cellText(item)};
  });
}

/** Shadow-DOM key/value table. Cells are text only — never HTML. Maps StyleGuideSpecTable. */
@defineElement('noizu-sg-spec-table')
export class NoizuSgSpecTable extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
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
        text-align: left;
        vertical-align: top;
        word-break: break-word;
      }

      th {
        width: 32%;
        color: var(--_muted);
        font-weight: 600;
      }

      tr:last-child th,
      tr:last-child td {
        border-bottom: 0;
      }
    `,
  ];

  /** Spec rows. Property-only — not an HTML attribute. */
  @property({attribute: false})
  rows: SgSpecRow[] = [];

  override render() {
    const rows = asRows(this.rows);
    return html`
      <table part="table" data-cy="sg.spec">
        <tbody>
          ${rows.map(
            (row) => html`
              <tr>
                <th scope="row">${row.key}</th>
                <td>${row.value}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-spec-table': NoizuSgSpecTable;
  }
}
