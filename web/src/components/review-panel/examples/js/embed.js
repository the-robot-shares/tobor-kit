import '@noizu/tobor-kit/review-panel.js';

const mount = document.querySelector('#review-panel-mount') ?? document.body;
const el =
  document.querySelector('tobor-review-panel') ?? document.createElement('tobor-review-panel');

el.artifactId = el.artifactId || 'artifact-1';
el.showComposer = true;
if (!el.isConnected) mount.append(el);

const artifactId = el.artifactId;

async function load() {
  const res = await fetch(`/artifacts/${encodeURIComponent(artifactId)}/reviews`, {
    credentials: 'same-origin',
  });
  if (!res.ok) return;
  const body = await res.json();
  el.reviews = body.reviews ?? [];
}

el.addEventListener('review-submit', (event) => {
  // Host-owned persist. Never a secret on the tag.
  fetch(`/artifacts/${encodeURIComponent(event.detail.artifactId)}/reviews`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({body: event.detail.body}),
  }).then((res) => {
    if (res.ok) return load();
  });
});

el.addEventListener('review-resolve', (event) => {
  fetch(
    `/artifacts/${encodeURIComponent(artifactId)}/reviews/${encodeURIComponent(event.detail.id)}/resolve`,
    {method: 'POST', credentials: 'same-origin'},
  ).then((res) => {
    if (res.ok) return load();
  });
});

load();
