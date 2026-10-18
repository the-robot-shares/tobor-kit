// Host apps: import '@noizu/tobor-kit/faq'.
import '../../noizu-faq.js';
import type {FaqToggleDetail, NoizuFaq} from '../../noizu-faq.js';

const faq = document.createElement('noizu-faq') as NoizuFaq;
faq.mode = 'many';
faq.innerHTML = `
  <details>
    <summary>What is this?</summary>
    <p>A Light DOM island that decorates slotted native details/summary.</p>
  </details>
  <details>
    <summary>Does the host need a backend?</summary>
    <p>No. The island is host-only markup.</p>
  </details>
  <details>
    <summary>Can only one item stay open?</summary>
    <p>Set mode="one" for accordion behavior.</p>
  </details>
`;

faq.addEventListener('faq-toggle', (event: CustomEvent<FaqToggleDetail>) => {
  // Host-owned: persist or analytics. The island does not POST this.
  console.log('faq-toggle', event.detail.open, event.detail.index);
});

document.body.append(faq);
