/**
 * Typed mount for the artifact family.
 * Host: import '@noizu/tobor-kit/artifact-view.js' and
 * '@noizu/tobor-kit/artifact-editor.js'.
 */
import '../../tobor-artifact-view.js';
import '../../tobor-artifact-editor.js';
import type {ToborArtifactView} from '../../tobor-artifact-view.js';
import type {ToborArtifactEditor} from '../../tobor-artifact-editor.js';
import {SAMPLE_ARTIFACT, type Artifact, type ArtifactSaveDetail, type ReviewStartDetail} from '../../types.js';

export interface MountArtifactOptions {
  artifact?: Artifact;
  onReviewStart?: (detail: ReviewStartDetail) => void;
  /** Host persists. Kit does not write. */
  onArtifactSave?: (detail: ArtifactSaveDetail) => void;
}

/**
 * Mount <tobor-artifact-view> + <tobor-artifact-editor>.
 * Host-owned: load artifact, persist save, start review.
 */
export function mountArtifactFamily(
  host: HTMLElement,
  options: MountArtifactOptions = {},
): {view: ToborArtifactView; editor: ToborArtifactEditor} {
  const artifact = options.artifact ?? SAMPLE_ARTIFACT;
  const view =
    host.querySelector('tobor-artifact-view') ?? document.createElement('tobor-artifact-view');
  const editor =
    host.querySelector('tobor-artifact-editor') ?? document.createElement('tobor-artifact-editor');

  view.artifact = artifact;
  editor.artifact = artifact;

  view.addEventListener('review-start', (event) => {
    options.onReviewStart?.((event as CustomEvent<ReviewStartDetail>).detail);
  });
  editor.addEventListener('artifact-save', (event) => {
    options.onArtifactSave?.((event as CustomEvent<ArtifactSaveDetail>).detail);
  });

  if (!view.isConnected) host.append(view);
  if (!editor.isConnected) host.append(editor);
  return {view, editor};
}
