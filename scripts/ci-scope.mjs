import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function classify(paths, full = false) {
 const relevant = paths.filter(p => !/(^|\/)(AGENTS?|CLAUDE|README|CI|VOICE-TESTING)\.md$|^docs\//.test(p));
 const unknown = relevant.some(p => !/^(web\/|elixir\/|scripts\/|\.github\/|Dockerfile$|\.dockerignore$|helm\/)/.test(p));
 const backend = full || unknown || relevant.some(p => /^(elixir\/|helm\/|Dockerfile$|\.dockerignore$|\.github\/workflows\/ci.yml|scripts\/ci-scope)/.test(p));
 const lit = full || unknown || relevant.some(p => /^(web\/|scripts\/|\.github\/workflows\/publish-lit.yml)/.test(p));
 const voiceOnly = relevant.length > 0 && relevant.every(p => /^web\/(src\/components\/(voice-agent|voice-session|transcript-view|robot-avatar)\/|test\/(voice-agent|voice-session|transcript-view|robot-avatar)\.test.ts)/.test(p));
 return {backend, lit, browserFiles: !full && voiceOnly ? 'test/{auth,client,voice-agent,voice-session,transcript-view,robot-avatar}.test.ts' : 'test/**/*.test.ts'};
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
 const base = process.env.CI_BASE;
 const paths = base && !/^0+$/.test(base) ? execFileSync('git',['diff','--name-only',`${base}...HEAD`],{encoding:'utf8'}).trim().split('\n').filter(Boolean) : ['.github/workflows/ci.yml','.github/workflows/publish-lit.yml'];
 const scope = classify(paths,process.env.CI_FULL === 'true');
 for (const [key,value] of Object.entries(scope)) appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);
 console.log('CI scope:',scope);
}
