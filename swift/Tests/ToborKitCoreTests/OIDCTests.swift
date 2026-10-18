import XCTest
@testable import ToborKitCore

final class OIDCTests: XCTestCase {

    /// Authentik-shaped per-provider issuer: a path under the host. The
    /// well-known URL must insert between host and path, not append.
    private let issuer = URL(string: "https://auth.example.test/application/o/tobor-kit/")!

    private let metadataJSON = """
    {
      "issuer": "https://auth.example.test/application/o/tobor-kit/",
      "authorization_endpoint": "https://auth.example.test/application/o/tobor-kit/authorize",
      "token_endpoint": "https://auth.example.test/application/o/tobor-kit/token",
      "code_challenge_methods_supported": ["S256"]
    }
    """

    private func makeClient(
        _ transport: MockTransport,
        tokenStore: any TokenStoring = InMemoryTokenStore(),
        pendingStore: any PendingAuthorizationStoring = InMemoryPendingAuthorizationStore()
    ) -> OIDCAuthClient {
        OIDCAuthClient(
            configuration: OIDCConfiguration(
                issuer: issuer,
                clientID: "tobor-kit",
                scopes: ["openid", "email", "profile"],
                redirectURI: "app://callback"
            ),
            transport: transport,
            tokenStore: tokenStore,
            pendingStore: pendingStore
        )
    }

    private func tokenResponseJSON(refresh: Bool = true) -> String {
        """
        {"access_token": "at_123", "token_type": "bearer", "expires_in": 300
         \(refresh ? ", \"refresh_token\": \"rt_123\"" : "")}
        """
    }

    // MARK: Discovery

    func testMetadataURLPathInsertion() {
        // Appending would 404 on Authentik's per-provider issuers — this exact
        // quirk is why `authentik` is a distinct provider value in the schema.
        let url = OIDCDiscovery.metadataURL(issuer: issuer)
        XCTAssertEqual(
            url.absoluteString,
            "https://auth.example.test/.well-known/oauth-authorization-server/application/o/tobor-kit/"
        )
    }

    func testMetadataURLWithoutPath() {
        let url = OIDCDiscovery.metadataURL(issuer: URL(string: "https://idp.example.test")!)
        XCTAssertEqual(
            url.absoluteString,
            "https://idp.example.test/.well-known/oauth-authorization-server"
        )
    }

    func testCanonicalIgnoresTrailingSlashOnly() {
        XCTAssertEqual(
            OIDCDiscovery.canonical(URL(string: "https://x.test/a/")!),
            OIDCDiscovery.canonical(URL(string: "https://x.test/a")!)
        )
        XCTAssertNotEqual(
            OIDCDiscovery.canonical(URL(string: "https://x.test/a")!),
            OIDCDiscovery.canonical(URL(string: "https://x.test/b")!)
        )
    }

    func testDiscoveryRejectsIssuerMismatch() async {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(
            metadataJSON.replacingOccurrences(
                of: "https://auth.example.test/application/o/tobor-kit/",
                with: "https://evil.test/other"
            ).utf8
        ))
        do {
            _ = try await makeClient(transport).metadata()
            XCTFail("expected discovery failure")
        } catch let error as ToborError {
            guard case .discovery(let message) = error else {
                return XCTFail("wrong error: \(error)")
            }
            XCTAssertTrue(message.contains("Issuer mismatch"), message)
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testDiscoveryRejectsPlainOnlyServers() async {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(
            metadataJSON.replacingOccurrences(
                of: #"["S256"]"#,
                with: #"["plain"]"#
            ).utf8
        ))
        do {
            _ = try await makeClient(transport).metadata()
            XCTFail("expected discovery failure")
        } catch let error as ToborError {
            guard case .discovery(let message) = error else {
                return XCTFail("wrong error: \(error)")
            }
            XCTAssertTrue(message.contains("S256"), message)
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    // MARK: Authorization round trip

    func testAuthorizationURLPersistsPendingBeforeReturning() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))
        let pendingStore = InMemoryPendingAuthorizationStore()
        let client = makeClient(transport, pendingStore: pendingStore)

        let url = try await client.authorizationURL()

        // The pending record must already be on disk — the browser open makes
        // the process a jetsam candidate.
        let pending = try await pendingStore.take()
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        XCTAssertEqual(items.first { $0.name == "response_type" }?.value, "code")
        XCTAssertEqual(items.first { $0.name == "client_id" }?.value, "tobor-kit")
        XCTAssertEqual(items.first { $0.name == "redirect_uri" }?.value, "app://callback")
        XCTAssertEqual(items.first { $0.name == "state" }?.value, pending?.state)
        XCTAssertEqual(items.first { $0.name == "code_challenge_method" }?.value, "S256")
        XCTAssertEqual(
            items.first { $0.name == "code_challenge" }?.value,
            pending?.pkce.challenge
        )
        XCTAssertEqual(items.first { $0.name == "scope" }?.value, "openid email profile")
    }

    func testHandleCallbackRejectsWrongState() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))
        let client = makeClient(transport)
        _ = try await client.authorizationURL()

        let callback = URL(string: "https://auth.example.test/callback?code=xyz&state=tampered")!
        do {
            _ = try await client.handleCallback(url: callback)
            XCTFail("expected stateMismatch")
        } catch let error as ToborError {
            XCTAssertEqual(error, .stateMismatch)
        }
    }

    func testHandleCallbackRejectsStaleFlow() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))
        let pendingStore = InMemoryPendingAuthorizationStore()
        let client = makeClient(transport, pendingStore: pendingStore)
        _ = try await client.authorizationURL()

        // Rewrite the persisted record to look 11 minutes old.
        if var pending = try pendingStore.take() {
            pending = PendingAuthorization(
                state: pending.state,
                pkce: pending.pkce,
                redirectURI: pending.redirectURI,
                createdAt: Date(timeIntervalSinceNow: -700)
            )
            try pendingStore.save(pending)
        } else {
            return XCTFail("no pending record")
        }

        let stale = try await client.authorizationURL()
        _ = stale // (the fresh save below is what the callback validates)

        // Expire the *second* record too, then present a matching state.
        if var pending = try pendingStore.take() {
            pending = PendingAuthorization(
                state: pending.state,
                pkce: pending.pkce,
                redirectURI: pending.redirectURI,
                createdAt: Date(timeIntervalSinceNow: -700)
            )
            try pendingStore.save(pending)
            let callback = URL(
                string: "https://auth.example.test/callback?code=xyz&state=\(pending.state)"
            )!
            do {
                _ = try await client.handleCallback(url: callback)
                XCTFail("expected authorizationExpired")
            } catch let error as ToborError {
                XCTAssertEqual(error, .authorizationExpired)
            }
        }
    }

    func testHandleCallbackSurfacesOAuthError() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))
        let pendingStore = InMemoryPendingAuthorizationStore()
        let client = makeClient(transport, pendingStore: pendingStore)
        let url = try await client.authorizationURL()
        let state = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            .queryItems!.first { $0.name == "state" }!.value!

        let callback = URL(
            string: "https://auth.example.test/callback?error=access_denied&error_description=nope&state=\(state)"
        )!
        do {
            _ = try await client.handleCallback(url: callback)
            XCTFail("expected oauth error")
        } catch let error as ToborError {
            XCTAssertEqual(error, .oauth(code: "access_denied", description: "nope"))
        }

        // The failed flow still consumed the verifier — no replay.
        XCTAssertNil(try pendingStore.take())
    }

    func testSuccessfulExchangePostsCodeAndVerifier() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))   // discovery
        transport.enqueue(status: 200, body: Data(tokenResponseJSON().utf8)) // token
        let pendingStore = InMemoryPendingAuthorizationStore()
        let tokenStore = InMemoryTokenStore()
        let client = makeClient(transport, tokenStore: tokenStore, pendingStore: pendingStore)

        let authURL = try await client.authorizationURL()
        let components = URLComponents(url: authURL, resolvingAgainstBaseURL: false)!
        let state = components.queryItems!.first { $0.name == "state" }!.value!
        let savedPending = try pendingStore.take()
        try pendingStore.save(savedPending!) // put it back for the callback

        let callback = URL(
            string: "https://auth.example.test/callback?code=the_code&state=\(state)"
        )!
        let tokens = try await client.handleCallback(url: callback)

        XCTAssertEqual(tokens.accessToken, "at_123")
        XCTAssertEqual(tokens.refreshToken, "rt_123")

        // The token POST must carry the code and the PKCE verifier.
        let body = String(decoding: transport.lastBody ?? Data(), as: UTF8.self)
        XCTAssertTrue(body.contains("grant_type=authorization_code"))
        XCTAssertTrue(body.contains("code=the_code"))
        XCTAssertTrue(body.contains("code_verifier=\(savedPending!.pkce.verifier)"))
        XCTAssertNil(components.queryItems!.first { $0.name == "code_verifier" })

        // And the tokens are in the store, not just memory.
        XCTAssertNotNil(try tokenStore.load())
    }

    func testAuthorizationHeaderRefreshesExpiredToken() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(metadataJSON.utf8))       // discovery
        transport.enqueue(status: 200, body: Data(tokenResponseJSON().utf8)) // refresh call
        let tokenStore = InMemoryTokenStore()
        let client = makeClient(transport, tokenStore: tokenStore)

        // An already-expired access token.
        try await client.adopt(AuthTokens(
            accessToken: "stale",
            refreshToken: "rt_123",
            expiresAt: Date(timeIntervalSinceNow: -60)
        ))

        let header = try await client.authorizationHeader()
        XCTAssertEqual(header, "Bearer at_123")
        XCTAssertTrue(try XCTUnwrap(tokenStore.load()).isExpired() == false)
    }

    func testInvalidGrantClearsSessionButTransportFailureDoesNot() async throws {
        let tokenStore = InMemoryTokenStore()
        let client = makeClient(MockTransport(), tokenStore: tokenStore)
        try await client.adopt(AuthTokens(
            accessToken: "stale",
            refreshToken: "rt_123",
            expiresAt: Date(timeIntervalSinceNow: -60)
        ))

        // invalid_grant: the credential is dead. Session cleared.
        let dead = MockTransport()
        dead.enqueue(status: 200, body: Data(metadataJSON.utf8))            // discovery
        dead.enqueue(status: 400, body: Data(#"{"error": "invalid_grant"}"#.utf8))
        do {
            _ = try await clientWith(dead, tokenStore: tokenStore).authorizationHeader()
            XCTFail("expected sessionExpired")
        } catch let error as ToborError {
            XCTAssertEqual(error, .sessionExpired)
        }
        XCTAssertNil(try tokenStore.load())

        // A 502 is retryable. The session survives.
        try await client.adopt(AuthTokens(
            accessToken: "stale",
            refreshToken: "rt_123",
            expiresAt: Date(timeIntervalSinceNow: -60)
        ))
        let flaky = MockTransport()
        flaky.enqueue(status: 200, body: Data(metadataJSON.utf8))           // discovery
        flaky.enqueue(status: 502, body: Data("<html>bad gateway</html>".utf8))
        do {
            _ = try await clientWith(flaky, tokenStore: tokenStore).authorizationHeader()
            XCTFail("expected an http error")
        } catch { /* the point is only what the session looks like after */ }
        let surviving = try tokenStore.load()
        XCTAssertEqual(surviving?.refreshToken, "rt_123")
    }

    private func clientWith(_ transport: MockTransport, tokenStore: (any TokenStoring)? = nil) -> OIDCAuthClient {
        makeClient(transport, tokenStore: tokenStore ?? InMemoryTokenStore())
    }

    // MARK: OIDCConfiguration from a projection

    func testConfigurationFromProjection() throws {
        var auth = GuideProjection.Auth()
        auth.issuer = "https://auth.derobot.is/application/o/tobor-kit/"
        auth.clientID = "tobor-kit"
        let config = try OIDCConfiguration(auth: auth, redirectURI: "app://cb")
        XCTAssertEqual(config.issuer.absoluteString, "https://auth.derobot.is/application/o/tobor-kit/")
        XCTAssertEqual(config.scopes, ["openid", "email", "profile"])
    }

    func testConfigurationRejectsMissingIssuer() {
        let auth = GuideProjection.Auth()
        XCTAssertThrowsError(try OIDCConfiguration(auth: auth, redirectURI: "app://cb"))
    }
}
