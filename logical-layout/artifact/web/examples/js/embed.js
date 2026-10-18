/**
 * Vanilla mount for the artifact family.
 * Host: import '@noizu/tobor-kit/artifact-view.js' and
 * '@noizu/tobor-kit/artifact-editor.js'.
 */
import '../../tobor-artifact-view.js';
import '../../tobor-artifact-editor.js';

const SAMPLE = {
  id: 'demo',
  title: 'Release notes',
  version: 1,
  body: 'Ship the island.\nDo not render HTML.',
  mime: 'text/plain',
};

/**
 * Mount view + editor. Host-owned: persist artifact-save, handle review-start.
 */
export function mountArtifactFamily(host, options = {}) {
  const artifact = options.artifact ?? SAMPLE;
  const view =
    host.querySelector('tobor-artifact-view') ?? document.createElement('tobor-artifact-view');
  const editor =
    host.querySelector('tobor-artifact-editor') ?? document.createElement('tobor-artifact-editor');

  view.artifact = artifact;
  editor.artifact = artifact;

  view.addEventListener('review-start', (event) => {
    options.onReviewStart?.(event.detail);
  });
  editor.addEventListener('artifact-save', (event) => {
    options.onArtifactSave?.(event.detail);
  });

  if (!view.isConnected) host.append(view);
  if (!editor.isConnected) host.append(editor);
  return {view, editor};
}
