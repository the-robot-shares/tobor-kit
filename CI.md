# CI checks and release publishing

Feature PRs target develop; release PRs from develop to main require a manual
regular merge commit. No workflow promotes or merges branches. CI publishes
artifacts only after that release merge (or an explicit main dispatch).

Both workflows classify changed paths, always reporting the lightweight
`changes` job. Operational docs skip heavy work. Lit changes do not compile
Elixir or build backend containers; backend changes do not build or publish
Lit. Unknown shared inputs conservatively check both. There is no duplicate
push-to-develop run after an already-tested feature PR merges.

Backend changes keep the entire existing fast Elixir suite, including auth,
plus a parallel Docker build on PRs. Cached dependencies survive lock changes.
Main publication remains gated by backend tests.

Lit PRs typecheck, build once, smoke-test React/native CDN imports, and run
browser tests. Voice-only changes select auth, client, voice, transcript and
avatar tests; shared/dependency changes retain the full browser suite. Main
and develop-to-main release PRs reuse the feature-PR browser validation and
retain typecheck/build, React and native CDN smoke checks. CDN artifacts are
built once, transferred to the publish job, then uploaded.

The `full` workflow_dispatch input runs all checks even if paths are unchanged.
Dispatch on develop validates without publishing; dispatch on main also
publishes. Full regressions remain explicit, not scheduled on every push.
