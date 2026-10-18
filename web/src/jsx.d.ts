export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'noizu-waitlist': {
        slug?: string;
        service?: string;
        list?: string;
        api?: string;
        source?: string;
        children?: unknown;
      };
      'noizu-cookie-consent': {
        'storage-key'?: string;
        mode?: 'categories' | 'essential-all' | string;
        children?: unknown;
      };
      'noizu-cookie-settings': {
        children?: unknown;
      };
      'noizu-faq': {
        mode?: 'many' | 'one' | string;
        children?: unknown;
      };
    }
  }
}
