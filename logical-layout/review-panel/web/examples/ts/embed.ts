// @ts-nocheck — host snippet; copy against @noizu/tobor-kit.
import {
  ToborReviewPanel,
  type Review,
  type ReviewResolveDetail,
  type ReviewSubmitDetail,
} from '@noizu/tobor-kit/review-panel.js';

const mount = document.querySelector('#review-panel-mount') ?? document.body;
const el = (document.querySelector('tobor-review-panel') ??
  document.createElement('tobor-review-panel')) as ToborReviewPanel;

el.artifactId = el.artifactId || 'artifact-1';
el.showComposer = true;
if (!el.isConnected) mount.append(el);

const artifactId = el.artifactId;

async function load(): Promise<void> {
  const res = await fetch(`/artifacts/${encodeURIComponent(artifactId)}/reviews`, {
    credentials: 'same-origin',
  });
  if (!res.ok) return;
  const body = (await res.json()) as {reviews?: Review[]};
  el.reviews = body.reviews ?? [];
}

el.addEventListener('review-submit', (event: CustomEvent<ReviewSubmitDetail>) => {
  // Host-owned persist. Never a secret on the tag.
  void fetch(`/artifacts/${encodeURIComponent(event.detail.artifactId)}/reviews`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({body: event.detail.body}),
  }).then((res) => {
    if (res.ok) return load();
  });
});

el.addEventListener('review-resolve', (event: CustomEvent<ReviewResolveDetail>) => {
  void fetch(
    `/artifacts/${encodeURIComponent(artifactId)}/reviews/${encodeURIComponent(event.detail.id)}/resolve`,
    {method: 'POST', credentials: 'same-origin'},
  ).then((res) => {
    if (res.ok) return load();
  });
});

void load();
