import {defineConfig} from 'cypress';

// Isolated component lane: every spec mounts on e2e/isolation/harness.html
// with all backend calls cy.intercept-mocked. Video recording is ON for this
// lane only; the live-host per-family specs keep cypress.config.ts (video:false).
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://127.0.0.1:8091',
    supportFile: false,
    specPattern: 'e2e/isolation/**/*.cy.ts',
    testIsolation: true,
  },
  video: true,
  videosFolder: 'cypress/videos/isolation',
  screenshotOnRunFailure: true,
  viewportWidth: 1100,
  viewportHeight: 900,
});
