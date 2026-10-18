import {expect, fixture, html} from '@open-wc/testing';
import {sendKeys} from '@web/test-runner-commands';
import {NoizuSgInput} from '../../noizu-sg-input.js';
import {NoizuSgSelect} from '../../noizu-sg-select.js';

describe('accessible styleguide fields', () => {
  it('styles native input and textarea consistently without applying label styles to fields', async () => {
    const input = await fixture<NoizuSgInput>(html`<noizu-sg-input label="Search"></noizu-sg-input>`);
    const textarea = await fixture<NoizuSgInput>(html`<noizu-sg-input label="Reason" type="textarea"></noizu-sg-input>`);
    const inputStyle = getComputedStyle(input.shadowRoot!.querySelector('input')!);
    const textareaStyle = getComputedStyle(textarea.shadowRoot!.querySelector('textarea')!);
    for (const property of ['borderTopWidth', 'borderTopStyle', 'borderTopColor', 'backgroundColor', 'color', 'paddingTop', 'paddingLeft', 'fontWeight'] as const) {
      expect(inputStyle[property], property).to.equal(textareaStyle[property]);
    }
    expect(inputStyle.paddingTop).to.equal('6px');
    expect(inputStyle.paddingLeft).to.equal('10px');
    expect(inputStyle.borderTopStyle).to.equal('solid');
    expect(inputStyle.marginBottom).to.equal('0px');
    expect(getComputedStyle(input.shadowRoot!.querySelector('label')!).marginBottom).to.equal('8px');
  });

  it('labels input/textarea internally and associates help and validation', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input label="Reason" placeholder="Explain the decision" help-text="Eight characters minimum" error error-message="Add a reason" required></noizu-sg-input>`);
    const field = el.shadowRoot!.querySelector('input')!;
    expect(field.labels![0].textContent).to.equal('Reason');
    expect(field.placeholder).to.equal('Explain the decision');
    expect(field.required).to.equal(true);
    expect(field.getAttribute('aria-invalid')).to.equal('true');
    expect(field.getAttribute('aria-describedby')).to.equal('help error');
    await expect(el).to.be.accessible();
    el.type = 'textarea';await el.updateComplete;
    expect(el.shadowRoot!.querySelector('textarea')!.labels![0].textContent).to.equal('Reason');
    el.focus();expect(el.shadowRoot!.activeElement?.tagName).to.equal('TEXTAREA');
  });
  it('preserves sg-input and emits exactly one composed change per edit, never again on blur', async () => {
    const el=await fixture<NoizuSgInput>(html`<noizu-sg-input label="Search"></noizu-sg-input>`);
    const received: string[]=[];const details: unknown[]=[];
    el.addEventListener('change',e=>{expect(e.composed).to.equal(true);received.push((e.target as NoizuSgInput).value)});
    el.addEventListener('sg-input',e=>details.push((e as CustomEvent).detail));
    el.focus();await sendKeys({type:'a'});await el.updateComplete;
    const field=el.shadowRoot!.querySelector('input')!;
    field.blur();await el.updateComplete;
    expect(received).to.deep.equal(['a']);expect(details).to.deep.equal([{value:'a'}]);
  });
  it('disabled inputs suppress edits and custom notifications', async () => {
    const el=await fixture<NoizuSgInput>(html`<noizu-sg-input label="Search" disabled></noizu-sg-input>`);
    let calls=0;el.addEventListener('change',()=>calls++);el.addEventListener('sg-input',()=>calls++);
    const field=el.shadowRoot!.querySelector('input')!;expect(field.disabled).to.equal(true);
    field.value='ignored';field.dispatchEvent(new Event('input',{bubbles:true}));expect(el.value).to.equal('');expect(calls).to.equal(0);
  });
  it('native select exposes labels, errors, disabled options and JSON options', async () => {
    const el=await fixture<NoizuSgSelect>(html`<noizu-sg-select label="Decision" help-text="Choose a next step" error error-message="Selection required" placeholder="Choose" required options='[{"value":"defer","label":"Defer"},{"value":"waive","label":"Waive","disabled":true}]'></noizu-sg-select>`);
    const field=el.shadowRoot!.querySelector('select')!;
    expect(field.labels![0].textContent).to.equal('Decision');expect(field.getAttribute('aria-describedby')).to.equal('help error');expect(field.required).to.equal(true);expect(field.options[2].disabled).to.equal(true);
    expect(field.getAttribute('aria-invalid')).to.equal('true');await expect(el).to.be.accessible();
  });
  it('supports native keyboard selection with one retargeted value notification', async () => {
    const el=await fixture<NoizuSgSelect>(html`<noizu-sg-select label="Owner" value="a" .options=${[{value:'a',label:'Alex'},{value:'b',label:'Blair'}]}></noizu-sg-select>`);
    const seen:string[]=[];let custom=0;
    el.addEventListener('change',e=>{expect(e.composed).to.equal(true);seen.push((e.target as NoizuSgSelect).value)});
    el.addEventListener('sg-change',e=>{expect((e as CustomEvent).detail).to.deep.equal({value:'b'});custom++});
    el.focus();expect(el.shadowRoot!.activeElement?.tagName).to.equal('SELECT');
    await sendKeys({press:'b'});await sendKeys({press:'Enter'});await el.updateComplete;
    expect(el.value).to.equal('b');expect(seen).to.deep.equal(['b']);expect(custom).to.equal(1);
  });
  it('programmatic selection updates silently; disabled select suppresses notifications', async () => {
    const el=await fixture<NoizuSgSelect>(html`<noizu-sg-select label="Owner" .options=${[{value:'a',label:'Alex'},{value:'b',label:'Blair'}]}></noizu-sg-select>`);
    let calls=0;el.addEventListener('change',()=>calls++);el.addEventListener('sg-change',()=>calls++);
    el.value='b';await el.updateComplete;const field=el.shadowRoot!.querySelector('select')!;expect(field.value).to.equal('b');expect(calls).to.equal(0);
    el.disabled=true;await el.updateComplete;expect(field.disabled).to.equal(true);field.value='a';field.dispatchEvent(new Event('change',{bubbles:true,composed:true}));expect(el.value).to.equal('b');expect(calls).to.equal(0);
  });
});
