import '@noizu/tobor-kit/sg-btn';
import '@noizu/tobor-kit/sg-card';
import '@noizu/tobor-kit/sg-card-grid';
import '@noizu/tobor-kit/sg-status';
import '@noizu/tobor-kit/sg-input';
import '@noizu/tobor-kit/sg-spec-table';
import '@noizu/tobor-kit/sg-steps';

const btn = document.createElement('noizu-sg-btn');
btn.variant = 'primary';
btn.size = 'md';
btn.textContent = 'Continue';
btn.addEventListener('sg-click', () => {
  // Host-owned: analytics / form submit. The island does not POST this.
  console.log('sg-click');
});

const card = document.createElement('noizu-sg-card');
card.href = '/plans';
card.innerHTML = '<span slot="header">Pro</span>Compare features<span slot="footer">From $9/mo</span>';
card.addEventListener('sg-card-select', (event) => {
  // Host-owned navigation. preventDefault to stop the inner <a>.
  event.preventDefault();
  console.log('sg-card-select', event.detail);
});

const grid = document.createElement('noizu-sg-card-grid');
grid.columns = 3;
grid.append(card);

const status = document.createElement('noizu-sg-status');
status.status = 'ok';
status.label = 'Ready';
status.description = 'All checks passed';

const field = document.createElement('noizu-sg-input');
field.name = 'email';
field.type = 'email';
field.addEventListener('sg-input', (event) => {
  // Host-owned persist / validate. The island does not POST this.
  console.log('sg-input', event.detail);
});

const spec = document.createElement('noizu-sg-spec-table');
spec.rows = [
  {key: 'Protocol', value: 'HTTPS'},
  {key: 'Note', value: '<b>text only</b>'},
];

const stepper = document.createElement('noizu-sg-steps');
stepper.steps = ['Plan', 'Build', 'Ship'];
stepper.current = 1;

document.body.append(btn, grid, status, field, spec, stepper);
