// Host apps: import '@noizu/tobor-kit/sg-btn', './sg-card', './sg-card-grid',
// './sg-status', './sg-input', './sg-spec-table', './sg-steps'.
import '../../noizu-sg-btn.js';
import '../../noizu-sg-card.js';
import '../../noizu-sg-card-grid.js';
import '../../noizu-sg-status.js';
import '../../noizu-sg-input.js';
import '../../noizu-sg-spec-table.js';
import '../../noizu-sg-steps.js';
import type {NoizuSgBtn, SgClickDetail} from '../../noizu-sg-btn.js';
import type {NoizuSgCard, SgCardSelectDetail} from '../../noizu-sg-card.js';
import type {NoizuSgCardGrid} from '../../noizu-sg-card-grid.js';
import type {NoizuSgStatus} from '../../noizu-sg-status.js';
import type {NoizuSgInput, SgInputDetail} from '../../noizu-sg-input.js';
import type {NoizuSgSpecTable} from '../../noizu-sg-spec-table.js';
import type {NoizuSgSteps} from '../../noizu-sg-steps.js';

const btn = (document.querySelector('noizu-sg-btn') ??
  document.createElement('noizu-sg-btn')) as NoizuSgBtn;
btn.variant = 'primary';
btn.size = 'md';
btn.type = 'button';
if (!btn.textContent?.trim()) btn.textContent = 'Continue';

btn.addEventListener('sg-click', (event: Event) => {
  const detail = (event as CustomEvent<SgClickDetail>).detail;
  // Host-owned: analytics / form submit. The island does not POST this.
  void detail;
});

const card = (document.querySelector('noizu-sg-card') ??
  document.createElement('noizu-sg-card')) as NoizuSgCard;
card.href = '/plans';
if (!card.childNodes.length) {
  card.innerHTML =
    '<span slot="header">Pro</span>Compare features<span slot="footer">From $9/mo</span>';
}

card.addEventListener('sg-card-select', (event: Event) => {
  const select = event as CustomEvent<SgCardSelectDetail>;
  // Host-owned navigation. preventDefault to stop the inner <a>.
  select.preventDefault();
  void select.detail.href;
});

const grid = (document.querySelector('noizu-sg-card-grid') ??
  document.createElement('noizu-sg-card-grid')) as NoizuSgCardGrid;
grid.columns = 3;
if (!card.isConnected) grid.append(card);

const status = (document.querySelector('noizu-sg-status') ??
  document.createElement('noizu-sg-status')) as NoizuSgStatus;
status.status = 'ok';
status.label = 'Ready';
status.description = 'All checks passed';

const field = (document.querySelector('noizu-sg-input') ??
  document.createElement('noizu-sg-input')) as NoizuSgInput;
field.name = 'email';
field.type = 'email';
field.addEventListener('sg-input', (event: Event) => {
  const detail = (event as CustomEvent<SgInputDetail>).detail;
  // Host-owned persist / validate. The island does not POST this.
  void detail.value;
});

const spec = (document.querySelector('noizu-sg-spec-table') ??
  document.createElement('noizu-sg-spec-table')) as NoizuSgSpecTable;
spec.rows = [
  {key: 'Protocol', value: 'HTTPS'},
  {key: 'Note', value: '<b>text only</b>'},
];

const stepper = (document.querySelector('noizu-sg-steps') ??
  document.createElement('noizu-sg-steps')) as NoizuSgSteps;
stepper.steps = ['Plan', 'Build', 'Ship'];
stepper.current = 1;

if (!btn.isConnected) document.body.append(btn);
if (!grid.isConnected) document.body.append(grid);
if (!status.isConnected) document.body.append(status);
if (!field.isConnected) document.body.append(field);
if (!spec.isConnected) document.body.append(spec);
if (!stepper.isConnected) document.body.append(stepper);
