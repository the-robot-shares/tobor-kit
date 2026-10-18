// @ts-nocheck — host snippet; copy against @noizu/tobor-kit.
// Typed mount of <noizu-page-comments> (npm entry `@noizu/tobor-kit/page-comments.js`).
import {
  NoizuPageComments,
  HttpDataSource,
  type CommentThread,
  type DataSource,
} from '@noizu/tobor-kit/page-comments.js';

const el = document.querySelector('noizu-page-comments') as NoizuPageComments;

el.site = 'my-site';
el.railMode = 'push'; // 'overlay' (default) | 'push'

const dataSource: DataSource = new HttpDataSource({
  apiBase: el.apiBase,
  site: el.site,
});
el.dataSource = dataSource;

el.addEventListener('page-comments-thread-create', (event) => {
  const {id} = (event as CustomEvent<{id: string}>).detail;
  console.info('thread created', id);
});

el.addEventListener('page-comments-thread-orphan', (event) => {
  // An anchor lost its target: the rail moved the card to "Orphaned".
  const {id} = (event as CustomEvent<{id: string}>).detail;
  console.info('thread orphaned', id);
});

export async function dumpThreads(pageKey: string): Promise<CommentThread[]> {
  return dataSource.listThreads(pageKey);
}
