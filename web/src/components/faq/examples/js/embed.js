import '@noizu/tobor-kit/faq';

const faq = document.createElement('noizu-faq');
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

faq.addEventListener('faq-toggle', (event) => {
  // Host-owned: persist or analytics. The island does not POST this.
  console.log('faq-toggle', event.detail);
});

document.body.append(faq);
