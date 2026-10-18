# scripts/ — CI/CD + CDN Publish Tooling

```
scripts/
├── cdn-s3.py                # S3 CDN asset helpers (Python)
├── test-cdn-s3.py           # Tests for cdn-s3.py
├── prepare-cdn.mjs          # Pre-publish CDN staging (Node)
├── publish-cdn.sh           # Publish web dist to CDN
├── publish-lit-cdn.sh       # Publish lit bundle to CDN
├── test-publish-cdn.sh      # Tests for publish-cdn.sh
├── test-publish-lit-cdn.py  # Tests for publish-lit-cdn.sh
├── smoke-cdn.mjs            # Post-publish CDN smoke check
├── smoke-cdn-registration.mjs  # Smoke-check element registration from CDN
└── ci-scope.mjs             # CI change-scope detection (+ ci-scope.test.mjs)
```

CDN cache rule: stale CDN assets are cache-busted with `?vsn=` content-hash
query, never purged.
