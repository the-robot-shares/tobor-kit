import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export type SgStepState = 'done' | 'current' | 'todo';

function asSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item == null ? '' : String(item)));
}

function stepState(index: number, current: number): SgStepState {
  if (index < current) return 'done';
  if (index === current) return 'current';
  return 'todo';
}

/** Shadow-DOM step progress. `current` is a 0-based index into `steps`. Maps StyleGuideStepProgress. */
@defineElement('noizu-sg-steps')
export class NoizuSgSteps extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
      }

      ol {
        display: flex;
        flex-wrap: wrap;
        gap: var(--_gap);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      li {
        flex: 1 1 4rem;
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      [part='bar'] {
        height: 4px;
        border-radius: 99px;
        background: var(--_border);
      }

      li[data-state='done'] [part='bar'],
      li[data-state='current'] [part='bar'] {
        background: var(--_accent);
      }

      li[data-state='todo'] {
        color: var(--_muted);
      }

      [part='index'] {
        font-size: 0.75em;
        color: var(--_muted);
      }

      [part='label'] {
        font-size: 0.9em;
        word-break: break-word;
      }

      li[data-state='current'] [part='label'] {
        font-weight: 650;
        color: var(--_fg);
      }
    `,
  ];

  /** Step labels. Property-only — not an HTML attribute. */
  @property({attribute: false})
  steps: string[] = [];

  /** 0-based index of the current step. */
  @property({type: Number, reflect: true})
  current = 0;

  override render() {
    const steps = asSteps(this.steps);
    const current = this.resolvedCurrent();
    return html`
      <ol part="steps" data-cy="sg.steps" data-current=${String(current)} aria-label="Progress">
        ${steps.map((label, index) => {
          const state = stepState(index, current);
          return html`
            <li
              part="step"
              data-state=${state}
              aria-current=${state === 'current' ? 'step' : 'false'}
            >
              <span part="bar" aria-hidden="true"></span>
              <span part="index">${index + 1}</span>
              <span part="label">${label}</span>
            </li>
          `;
        })}
      </ol>
    `;
  }

  private resolvedCurrent(): number {
    const n = Math.floor(Number(this.current));
    return Number.isFinite(n) ? n : 0;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-steps': NoizuSgSteps;
  }
}
