# swift/ — SwiftUI Components

Swift Package (root `Package.swift`). Swift conventions:
[`../SWIFT-CONVENTIONS.md`](../SWIFT-CONVENTIONS.md).

```
swift/
├── Sources/
│   └── ToborKitCore/
│       ├── Auth/              # OIDCAuthClient, PKCE, TokenStore
│       ├── Models/
│       ├── Networking/
│       ├── SSE/               # Server-sent events client
│       ├── Transcript/
│       └── Voice/             # VoiceAdapter
├── Tests/
├── Catalog/                   # Component catalog app (CatalogApp.swift,
│                              #   ComponentCatalog.swift)
└── README.md
```

Per-component views/models live beside their lit element under
`web/src/components/<name>/swift/` — ToborKitCore holds shared infrastructure.
`.build/` is gitignored.
