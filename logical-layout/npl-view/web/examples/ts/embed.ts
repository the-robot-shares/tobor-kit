/**
 * Typed mount for tobor-npl-view.
 * Host: import '@noizu/tobor-kit/npl-view.js'.
 */
import '../../npl-view.js';
import {SAMPLE_SOURCE} from '../../highlight.js';
import type {NplCopyDetail, ToborNplView} from '../../npl-view.js';

export interface MountNplViewOptions {
  source?: string;
  onNplCopy?: (detail: NplCopyDetail) => void;
}

/**
 * Mount <tobor-npl-view>. Host-owned: supply source. Optional npl-copy listener.
 */
export function mountNplView(
  host: HTMLElement,
  options: MountNplViewOptions = {},
): ToborNplView {
  const el =
    host.querySelector('tobor-npl-view') ?? document.createElement('tobor-npl-view');
  el.source = options.source ?? SAMPLE_SOURCE;
  el.addEventListener('npl-copy', (event) => {
    options.onNplCopy?.((event as CustomEvent<NplCopyDetail>).detail);
  });
  if (!el.isConnected) host.append(el);
  return el;
}
