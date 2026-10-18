import Foundation

/// RFC 8414 authorization-server metadata — only the fields this client acts on.
struct OIDCServerMetadata: Sendable, Hashable, Codable {
    let issuer: URL
    let authorizationEndpoint: URL
    let tokenEndpoint: URL
    let scopesSupported: [String]?
    let codeChallengeMethodsSupported: [String]?

    private enum CodingKeys: String, CodingKey {
        case issuer
        case authorizationEndpoint = "authorization_endpoint"
        case tokenEndpoint = "token_endpoint"
        case scopesSupported = "scopes_supported"
        case codeChallengeMethodsSupported = "code_challenge_methods_supported"
    }

    /// Absence is not disqualifying (the field is optional in the RFC), but an
    /// explicit list without `S256` is a server this client cannot safely use.
    var supportsS256: Bool {
        guard let methods = codeChallengeMethodsSupported else { return true }
        return methods.contains("S256")
    }
}

/// Fetches and **validates** RFC 8414 metadata.
///
/// The `issuer` check is mandatory per RFC 8414 §3.3: every endpoint the client
/// subsequently posts credentials to comes out of this document, and a document
/// whose issuer does not match byte-exact is a redirect away from being an
/// attacker's.
struct OIDCDiscovery: Sendable {

    let transport: any HTTPTransporting

    /// The well-known segment is inserted between host and issuer path, not
    /// appended after it. This is the shape Authentik's per-provider issuers
    /// (`https://host/application/o/<slug>`) rely on; appending would produce a
    /// URL that 404s.
    static func metadataURL(issuer: URL) -> URL {
        var components = URLComponents(url: issuer, resolvingAgainstBaseURL: false)
        let issuerPath = components?.path ?? ""
        components?.path = "/.well-known/oauth-authorization-server"
            + (issuerPath == "/" ? "" : issuerPath)
        components?.query = nil
        components?.fragment = nil
        return components?.url ?? issuer
    }

    /// Issuer comparison is byte-exact except for a trailing slash, which
    /// `URL` and several servers disagree about and which carries no meaning.
    static func canonical(_ url: URL) -> String {
        var text = url.absoluteString
        while text.hasSuffix("/") { text.removeLast() }
        return text
    }

    func metadata(issuer: URL) async throws -> OIDCServerMetadata {
        var request = URLRequest(url: Self.metadataURL(issuer: issuer))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await transport.send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw ToborError.discovery("Could not reach the authorization server (HTTP \(response.statusCode))")
        }
        let metadata: OIDCServerMetadata
        do {
            metadata = try ToborJSON.decode(OIDCServerMetadata.self, from: data)
        } catch {
            throw ToborError.discovery("Metadata is malformed: \(String(describing: error))")
        }
        guard Self.canonical(metadata.issuer) == Self.canonical(issuer) else {
            throw ToborError.discovery(
                "Issuer mismatch: server says \(Self.canonical(metadata.issuer)), expected \(Self.canonical(issuer))"
            )
        }
        guard metadata.supportsS256 else {
            throw ToborError.discovery("The authorization server does not support PKCE S256")
        }
        return metadata
    }
}

/// Static OIDC client configuration, resolved from the guide projection's
/// `auth` block plus a redirect the host app registers.
public struct OIDCConfiguration: Sendable, Hashable {
    public var issuer: URL
    public var clientID: String
    public var scopes: [String]
    public var redirectURI: String

    /// Builds from the projection. `redirectURI` is not in the projection —
    /// the host knows its own URL scheme.
    public init(auth: GuideProjection.Auth, redirectURI: String) throws {
        guard let issuer = auth.issuer, let url = URL(string: issuer), url.scheme != nil else {
            throw ToborError.discovery("The guide projection carries no usable issuer URL")
        }
        guard let clientID = auth.clientID else {
            throw ToborError.discovery("The guide projection carries no client_id")
        }
        // `authentik` is OIDC with the portfolio's known quirks; the quirks
        // (trailing-slash canonicalisation, path-inserted well-known) are
        // already baked into ``OIDCDiscovery``, so both providers share one path.
        self.issuer = url
        self.clientID = clientID
        self.scopes = auth.scopes.isEmpty ? ["openid", "email", "profile"] : auth.scopes
        self.redirectURI = redirectURI
    }

    public init(issuer: URL, clientID: String, scopes: [String], redirectURI: String) {
        self.issuer = issuer
        self.clientID = clientID
        self.scopes = scopes
        self.redirectURI = redirectURI
    }
}

/// OIDC Authorization Code flow with PKCE, against the issuer the guide
/// projection names (Authentik in the tested deployment).
///
/// The UI concern — putting a browser on screen — is deliberately not here:
/// this actor produces an authorization URL and consumes the callback URL, so
/// the flow is testable without `ASWebAuthenticationSession`. The host opens
/// the URL (typically `ASWebAuthenticationSession`) and hands the redirect
/// back to ``handleCallback(url:)``.
///
/// The PKCE verifier is persisted **before** the URL is returned: presenting
/// the browser makes the app a jetsam candidate, and a verifier that lived only
/// in memory would be gone when the callback relaunched the process.
public actor OIDCAuthClient: AuthProviding {

    private let configuration: OIDCConfiguration
    private let transport: any HTTPTransporting
    private let tokenStore: any TokenStoring
    private let pendingStore: any PendingAuthorizationStoring
    private let discovery: OIDCDiscovery

    private var metadataCache: OIDCServerMetadata?
    private var cachedTokens: AuthTokens?
    private var inFlightRefresh: Task<AuthTokens, Error>?

    public init(
        configuration: OIDCConfiguration,
        transport: any HTTPTransporting = URLSessionTransport(),
        tokenStore: any TokenStoring = KeychainTokenStore(),
        pendingStore: any PendingAuthorizationStoring = KeychainPendingAuthorizationStore()
    ) {
        self.configuration = configuration
        self.transport = transport
        self.tokenStore = tokenStore
        self.pendingStore = pendingStore
        self.discovery = OIDCDiscovery(transport: transport)
    }

    /// Convenience for the common embedding: everything straight from the
    /// projection the client already fetched.
    public init(
        auth: GuideProjection.Auth,
        redirectURI: String,
        transport: any HTTPTransporting = URLSessionTransport(),
        tokenStore: any TokenStoring = KeychainTokenStore(),
        pendingStore: any PendingAuthorizationStoring = KeychainPendingAuthorizationStore()
    ) throws {
        self.init(
            configuration: try OIDCConfiguration(auth: auth, redirectURI: redirectURI),
            transport: transport,
            tokenStore: tokenStore,
            pendingStore: pendingStore
        )
    }

    // MARK: - Flow

    func metadata() async throws -> OIDCServerMetadata {
        if let metadataCache { return metadataCache }
        let fetched = try await discovery.metadata(issuer: configuration.issuer)
        metadataCache = fetched
        return fetched
    }

    /// The URL to open, with the pending record already persisted.
    public func authorizationURL() async throws -> URL {
        let metadata = try await metadata()
        let pending = PendingAuthorization(redirectURI: configuration.redirectURI)
        try pendingStore.save(pending)

        guard var components = URLComponents(
            url: metadata.authorizationEndpoint,
            resolvingAgainstBaseURL: false
        ) else {
            throw ToborError.discovery("Authorization endpoint is not a usable URL")
        }
        var items = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: configuration.clientID),
            URLQueryItem(name: "redirect_uri", value: configuration.redirectURI),
            URLQueryItem(name: "state", value: pending.state),
            URLQueryItem(name: "code_challenge", value: pending.pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: pending.pkce.method)
        ]
        if !configuration.scopes.isEmpty {
            items.append(URLQueryItem(name: "scope", value: configuration.scopes.joined(separator: " ")))
        }
        components.queryItems = (components.queryItems ?? []) + items
        guard let url = components.url else {
            throw ToborError.discovery("Could not build the authorization URL")
        }
        return url
    }

    /// Consume the redirect. Validates `state`, refuses a stale flow, exchanges
    /// the code, persists the tokens.
    @discardableResult
    public func handleCallback(url: URL) async throws -> AuthTokens {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw ToborError.malformedResponse("Callback URL could not be parsed")
        }
        let items = components.queryItems ?? []
        func value(_ name: String) -> String? { items.first { $0.name == name }?.value }

        // Single-use take: a verifier that survives its callback is a replay.
        guard let pending = try pendingStore.take() else {
            throw ToborError.stateMismatch
        }
        // An error response still consumed the pending record above — the flow
        // is over either way, and leaving the verifier behind invites a replay.
        if let errorCode = value("error") {
            throw ToborError.oauth(code: errorCode, description: value("error_description"))
        }
        guard let state = value("state"), constantTimeEquals(state, pending.state) else {
            throw ToborError.stateMismatch
        }
        guard !pending.isExpired() else {
            throw ToborError.authorizationExpired
        }
        guard let code = value("code") else {
            throw ToborError.malformedResponse("Callback carried no authorization code")
        }

        let metadata = try await metadata()
        let tokens = try await postToken(
            endpoint: metadata.tokenEndpoint,
            form: [
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": pending.redirectURI,
                "client_id": configuration.clientID,
                "code_verifier": pending.pkce.verifier
            ]
        )
        try persist(tokens)
        return tokens
    }

    // MARK: - AuthProviding

    public func authorizationHeader() async throws -> String? {
        guard let tokens = try currentTokens() else { return nil }
        if tokens.isExpired() {
            return "Bearer \(try await refresh().accessToken)"
        }
        return "Bearer \(tokens.accessToken)"
    }

    public func hasSession() async -> Bool {
        (try? currentTokens()) != nil
    }

    public func signOut() async throws {
        cachedTokens = nil
        inFlightRefresh = nil
        try? pendingStore.clear()
        try tokenStore.clear()
    }

    // MARK: - Refresh

    @discardableResult
    public func refresh() async throws -> AuthTokens {
        if let inFlightRefresh {
            return try await inFlightRefresh.value
        }
        guard let tokens = try currentTokens() else {
            throw ToborError.notAuthenticated
        }
        guard let refreshToken = tokens.refreshToken else {
            throw ToborError.notAuthenticated
        }

        let metadata = try await metadata()

        // Re-check after suspending: a concurrent caller may have started the
        // refresh while this one awaited discovery.
        if let inFlightRefresh {
            return try await inFlightRefresh.value
        }

        let form = [
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
            "client_id": configuration.clientID
        ]
        let fallback = tokens.refreshToken
        let transport = self.transport
        let endpoint = metadata.tokenEndpoint

        let task = Task<AuthTokens, Error> {
            try await Self.postToken(
                transport: transport,
                endpoint: endpoint,
                form: form,
                fallbackRefresh: fallback
            )
        }
        inFlightRefresh = task
        defer { inFlightRefresh = nil }

        do {
            let refreshed = try await task.value
            try persist(refreshed)
            return refreshed
        } catch let error as ToborError where error == .sessionExpired {
            // Only `invalid_grant` clears the session — a transport failure or
            // a 5xx leaves it alone so a dropped connection is not a sign-out.
            cachedTokens = nil
            try? tokenStore.clear()
            throw error
        }
    }

    // MARK: - Token endpoint

    private func postToken(endpoint: URL, form: [String: String]) async throws -> AuthTokens {
        try await Self.postToken(transport: transport, endpoint: endpoint, form: form, fallbackRefresh: nil)
    }

    private static func postToken(
        transport: any HTTPTransporting,
        endpoint: URL,
        form: [String: String],
        fallbackRefresh: String?
    ) async throws -> AuthTokens {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = Data(formURLEncoded(form).utf8)

        let (data, response) = try await transport.send(request)
        guard (200..<300).contains(response.statusCode) else {
            let error = try? ToborJSON.decode(OAuthTokenErrorResponse.self, from: data)
            if error?.error == "invalid_grant" {
                throw ToborError.sessionExpired
            }
            if let error {
                throw ToborError.oauth(code: error.error, description: error.errorDescription)
            }
            // No parseable OAuth error: a 5xx or an ingress page. Retryable, so
            // it must NOT surface as something that clears the session.
            throw ToborError.http(status: response.statusCode, error: nil)
        }

        let payload: OAuthTokenResponse
        do {
            payload = try ToborJSON.decode(OAuthTokenResponse.self, from: data)
        } catch {
            throw ToborError.malformedResponse(String(describing: error))
        }
        guard let refreshToken = payload.refreshToken ?? fallbackRefresh else {
            throw ToborError.malformedResponse("No refresh token in the token response")
        }
        return AuthTokens(
            accessToken: payload.accessToken,
            refreshToken: refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(payload.expiresIn ?? 900))
        )
    }

    static func formURLEncoded(_ form: [String: String]) -> String {
        // `+` must be percent-encoded in a form body — it decodes as a space —
        // and it appears in base64 output, which is what half of these values
        // are. `.urlQueryAllowed` permits it, so it is removed explicitly.
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=?/")
        return form
            .sorted { $0.key < $1.key }
            .map { key, value in
                let k = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
                let v = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
                return "\(k)=\(v)"
            }
            .joined(separator: "&")
    }

    // MARK: - Storage

    private func currentTokens() throws -> AuthTokens? {
        if let cachedTokens { return cachedTokens }
        let loaded = try tokenStore.load()
        cachedTokens = loaded
        return loaded
    }

    private func persist(_ tokens: AuthTokens) throws {
        cachedTokens = tokens
        try tokenStore.save(tokens)
    }

    /// Install tokens directly. Tests and host-app hand-offs only.
    public func adopt(_ tokens: AuthTokens) throws {
        try persist(tokens)
    }
}

// MARK: - Wire shapes

struct OAuthTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int?

    private enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try c.decode(String.self, forKey: .accessToken)
        refreshToken = try c.decodeIfPresent(String.self, forKey: .refreshToken)
        expiresIn = try c.decodeIfPresent(Int.self, forKey: .expiresIn)
    }
}

struct OAuthTokenErrorResponse: Decodable {
    let error: String
    let errorDescription: String?

    private enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        error = try c.decode(String.self, forKey: .error)
        errorDescription = try c.decodeIfPresent(String.self, forKey: .errorDescription)
    }
}
