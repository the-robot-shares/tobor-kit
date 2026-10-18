// Dev server for component demo pages under demo/ (source TS + bare lit
// imports). Start with:
//   npx wds --config wds.demo.config.mjs --root . --port 8090
// then run Cypress (baseUrl defaults to http://127.0.0.1:8090):
//   npx cypress run --spec "src/components/page-comments/test/e2e/*.cy.ts"
import {nodeResolvePlugin} from '@web/dev-server';
import {esbuildPlugin} from '@web/dev-server-esbuild';

export default {
  nodeResolve: true,
  plugins: [
    nodeResolvePlugin(),
    esbuildPlugin({ts: true, target: 'es2022', tsconfig: 'tsconfig.json'}),
  ],
};
