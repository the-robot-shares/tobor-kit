// Vanilla mount of <noizu-page-comments> against the annotate contract.
// Host-owned: the IdP and the annotate service are NOT implemented here —
// see docs/backend-requirements.md for the real endpoints.
import {
  HttpDataSource,
  MemoryDataSource, // swap in for demos without a backend
} from '@noizu/tobor-kit/page-comments.js';

const el = document.querySelector('noizu-page-comments');

el.site = 'my-site';
el.apiBase = 'https://annotate-srv.therobotlives.com'; // default; shown for clarity
el.dataSource = new HttpDataSource({apiBase: el.apiBase, site: el.site});
// Anonymous browsing works; the "Sign in" button starts the popup flow when
// the host wants write access. Tokens stay in memory inside the widget.

el.addEventListener('page-comments-toggle', (e) => console.info('toggle', e.detail.enabled));
el.addEventListener('page-comments-thread-create', (e) => console.info('created', e.detail.id));
el.addEventListener('page-comments-thread-orphan', (e) => console.info('orphaned', e.detail.id));
el.addEventListener('page-comments-page-change', (e) => console.info('page', e.detail.pageKey));

// Optional host-side controls:
// el.open(); el.close(); el.focusThread('thread-123'); el.refresh();
