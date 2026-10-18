// Host apps: import '@noizu/tobor-kit/mode-toggle.js' (+ types from '@noizu/tobor-kit').
import '../../mode-toggle.js';
import type {GuideMode} from '../../../../types.js';

export interface ModeChangeDetail {
  mode: GuideMode;
  previous: GuideMode;
}

export interface MountModeToggleOptions {
  modes?: GuideMode[];
  mode?: GuideMode;
  disabled?: boolean;
  onChange?: (detail: ModeChangeDetail) => void;
}

/**
 * Mount <tobor-mode-toggle> and listen for tobor-mode-change {mode, previous}.
 * Host-owned: optional persistence of detail.mode. No secrets.
 */
export function mountModeToggle(
  host: HTMLElement,
  options: MountModeToggleOptions = {},
): HTMLElementTagNameMap['tobor-mode-toggle'] {
  const el = document.createElement('tobor-mode-toggle');
  el.modes = options.modes ?? ['text', 'voice', 'transcript'];
  el.mode = options.mode ?? 'text';
  el.disabled = options.disabled ?? false;
  el.addEventListener('tobor-mode-change', (event) => {
    const detail = (event as CustomEvent<ModeChangeDetail>).detail;
    host.dataset.mode = detail.mode;
    host.dataset.previous = detail.previous;
    options.onChange?.(detail);
  });
  host.append(el);
  return el;
}
