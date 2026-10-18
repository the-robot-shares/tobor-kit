import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify} from './ci-scope.mjs';
test('docs do not rebuild either product',()=> {const s=classify(['README.md']);assert.equal(s.backend,false);assert.equal(s.lit,false);});
test('Lit edits do not compile Elixir',()=> {const s=classify(['web/src/components/voice-agent/voice-agent.ts']);assert.equal(s.backend,false);assert.equal(s.lit,true);assert.match(s.browserFiles,/auth,client,voice-agent/);});
test('backend auth edits retain backend gate only',()=> {const s=classify(['elixir/lib/auth.ex']);assert.equal(s.backend,true);assert.equal(s.lit,false);});
test('shared CI classifier checks both products',()=> {const s=classify(['scripts/ci-scope.mjs']);assert.equal(s.backend,true);assert.equal(s.lit,true);});
test('dependency and shared UI changes retain all browser tests',()=>assert.equal(classify(['web/package-lock.json']).browserFiles,'test/**/*.test.ts'));
test('full dispatch checks everything',()=> {const s=classify(['README.md'],true);assert.equal(s.backend,true);assert.equal(s.lit,true);});

test('mixed UI and backend changes check both',()=> {const s=classify(['web/src/index.ts','elixir/lib/auth.ex']);assert.equal(s.backend,true);assert.equal(s.lit,true);});
test('unknown shared and content inputs conservatively check both',()=> {
 for(const p of ['schema/api.json','content/example.md']) {const s=classify([p]);assert.equal(s.backend,true);assert.equal(s.lit,true);}
});
test('backend dependencies and chart changes retain backend gate',()=> {
 for(const p of ['elixir/mix.lock','helm/tobor-kit/values.yaml','Dockerfile']) assert.equal(classify([p]).backend,true);
});
