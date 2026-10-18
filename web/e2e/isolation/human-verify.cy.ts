/// <reference types="cypress" />
// Isolation lane: noizu-human-verify on the blank harness page.
// Provider scripts are cy.intercept-mocked; the widget APIs are pre-seeded on
// window so the kit never touches the real Turnstile / reCAPTCHA endpoints.
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=0xPUBKEY';

function visit(seed: (win: any) => void) {
  cy.intercept('GET', TURNSTILE_SRC, '').as('turnstile-script');
  cy.intercept('GET', RECAPTCHA_SRC, '').as('recaptcha-script');
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/human-verify/noizu-human-verify.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
      seed(win);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(attrs: Record<string, string> = {}) {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('noizu-human-verify');
    win.unmount();
    win.__events.length = 0;
    const el = win.document.createElement('noizu-human-verify');
    const native = el.dispatchEvent.bind(el);
    el.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    win.document.getElementById('mount-root').appendChild(el);
    return el;
  });
}

const events = () => cy.window().then((win: any) => win.__events);

describe('Given human-verification providers, when mounted on the isolation harness, then verified events carry provider and token', () => {
  it('Given provider=none, when mounted, then verified fires immediately with an empty token and no provider script is requested', () => {
    visit(() => undefined);
    mount({provider: 'none'});
    cy.get('noizu-human-verify').shadow().find('[data-cy="verify.root"]').should('have.attr', 'aria-label', 'Human verification skipped');
    events().then((evts: any[]) => {
      const verified = evts.filter((e) => e.type === 'verified');
      expect(verified.length, 'verified emitted once').to.eq(1);
      expect(verified[0].detail).to.deep.eq({provider: 'none', token: ''});
    });
    cy.get('@turnstile-script.all').should('have.length', 0);
    cy.screenshot('human-verify-none');
  });

  it('Given provider=turnstile, when the widget callback answers, then verified carries the token and reset() goes through the API', () => {
    visit((win: any) => {
      win.__tsReset = [] as string[];
      win.turnstile = {
        render: (host: HTMLElement, opts: any) => {
          win.__ts = {host, opts};
          return 'widget-1';
        },
        reset: (id?: string) => {
          win.__tsReset.push(id ?? 'all');
        },
        remove: () => undefined,
      };
    });
    mount({provider: 'turnstile', 'site-key': '0xPUBKEY', action: 'login'});
    cy.window({timeout: 10000}).should((win: any) => expect(win.__ts, 'turnstile.render called').to.exist);
    cy.window().then((win: any) => {
      expect(win.__ts.opts.sitekey).to.eq('0xPUBKEY');
      expect(win.__ts.opts.action).to.eq('login');
      expect(win.__ts.host).to.eq(win.document.querySelector('noizu-human-verify').shadowRoot.querySelector('[data-cy="verify.widget"]'));
      win.__ts.opts.callback('tok_abc123');
    });
    events().then((evts: any[]) => {
      const verified = evts.filter((e) => e.type === 'verified');
      expect(verified.length, 'verified emitted').to.eq(1);
      expect(verified[0].detail).to.deep.eq({provider: 'turnstile', token: 'tok_abc123'});
    });
    cy.screenshot('human-verify-turnstile-verified');
    cy.window().then((win: any) => {
      win.document.querySelector('noizu-human-verify').reset();
    });
    cy.window().then((win: any) => expect(win.__tsReset).to.deep.eq(['widget-1']));
    cy.screenshot('human-verify-turnstile-reset');
  });

  it('Given provider=recaptcha-v3, when grecaptcha.execute resolves, then verified carries the execution token', () => {
    visit((win: any) => {
      win.grecaptcha = {
        ready: (cb: () => void) => cb(),
        execute: async (siteKey: string, opts: {action: string}) => {
          win.__rc = {siteKey, action: opts.action};
          return 'rc_tok_987';
        },
      };
    });
    mount({provider: 'recaptcha-v3', 'site-key': '0xPUBKEY', action: 'checkout'});
    cy.window({timeout: 10000}).should((win: any) => expect(win.__rc, 'grecaptcha.execute called').to.exist);
    cy.window().then((win: any) => {
      expect(win.__rc).to.deep.eq({siteKey: '0xPUBKEY', action: 'checkout'});
    });
    events().then((evts: any[]) => {
      const verified = evts.filter((e) => e.type === 'verified');
      expect(verified.length, 'verified emitted').to.eq(1);
      expect(verified[0].detail).to.deep.eq({provider: 'recaptcha-v3', token: 'rc_tok_987'});
    });
    cy.screenshot('human-verify-recaptcha-verified');
  });

  it('Given turnstile without a site-key, when mounted, then the missing-key status renders and no verified event fires', () => {
    visit((win: any) => {
      win.turnstile = {render: () => 'x', reset: () => undefined, remove: () => undefined};
    });
    mount({provider: 'turnstile'});
    cy.get('noizu-human-verify').shadow().find('[part="status"]').should('contain', 'Public site-key required.');
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'verified')).to.have.length(0));
    cy.screenshot('human-verify-missing-site-key');
  });
});
