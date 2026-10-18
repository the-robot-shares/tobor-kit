import {defineConfig} from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://127.0.0.1:8090',
    supportFile: false,
    specPattern: ['e2e/**/*.cy.ts', 'src/components/**/test/e2e/**/*.cy.ts'],
  },
  video: false,
  viewportWidth: 1100,
  viewportHeight: 900,
});
