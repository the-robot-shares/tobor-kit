import '@noizu/tobor-kit/mode-toggle.js';

/**
 * Mount <tobor-mode-toggle> and listen for tobor-mode-change {mode, previous}.
 * Host-owned: optional persistence of event.detail.mode. No secrets.
 */
export function mountModeToggle(host, options = {}) {
  const el = document.createElement('tobor-mode-toggle');
  el.modes = options.modes ?? ['text', 'voice', 'transcript'];
  el.mode = options.mode ?? 'text';
  el.disabled = options.disabled ?? false;
  el.addEventListener('tobor-mode-change', (event) => {
    const {mode, previous} = event.detail;
    host.dataset.mode = mode;
    host.dataset.previous = previous;
    options.onChange?.(event.detail);
  });
  host.append(el);
  return el;
}
