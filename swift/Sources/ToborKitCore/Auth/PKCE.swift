import Foundation
import CryptoKit

/// PKCE (RFC 7636) parameters for one authorization attempt.
///
/// `S256` only. `plain` is still in the RFC and Authentik would accept it, but
/// a `plain` challenge is the verifier in the clear in a URL that lands in
/// browser history and the system log — it protects nothing. There is no code
/// path here that can emit it.
public struct PKCEChallenge: Sendable, Hashable, Codable {

    /// 64 characters from the RFC 7636 unreserved set. The RFC permits 43–128.
    public let verifier: String

    /// BASE64URL(SHA256(verifier)), unpadded.
    public let challenge: String

    public let method = "S256"

    private enum CodingKeys: String, CodingKey { case verifier, challenge }

    public init(verifier: String) {
        self.verifier = verifier
        self.challenge = Self.s256(verifier)
    }

    public init() {
        self.init(verifier: Self.makeVerifier())
    }

    /// The unreserved set from RFC 7636 §4.1: `[A-Za-z0-9-._~]`.
    private static let alphabet = Array(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    )

    public static func makeVerifier(length: Int = 64) -> String {
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in
            alphabet[Int.random(in: 0..<alphabet.count, using: &generator)]
        })
    }

    public static func s256(_ verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncodedString()
    }
}

/// A flow in progress, persisted **before** the browser is opened.
///
/// Presenting `ASWebAuthenticationSession` makes the app a jetsam candidate. A
/// verifier that lived only in memory would be gone when the callback relaunched
/// the process, and the user would see a sign-in that silently does nothing.
public struct PendingAuthorization: Sendable, Hashable, Codable {
    public let state: String
    public let pkce: PKCEChallenge
    public let redirectURI: String
    public let createdAt: Date

    /// Older than this and the record is refused rather than used. A stale
    /// `state` is either a user who wandered off mid-flow or a replay.
    public static let maxAge: TimeInterval = 600

    public init(
        state: String = PKCEChallenge.makeVerifier(length: 32),
        pkce: PKCEChallenge = PKCEChallenge(),
        redirectURI: String,
        createdAt: Date = Date()
    ) {
        self.state = state
        self.pkce = pkce
        self.redirectURI = redirectURI
        self.createdAt = createdAt
    }

    public func isExpired(at now: Date = Date()) -> Bool {
        now.timeIntervalSince(createdAt) > Self.maxAge
    }
}

extension Data {
    /// BASE64URL without padding, per RFC 4648 §5.
    public func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

/// Length-independent comparison for the `state` check. `==` on `String` exits
/// at the first differing byte; the timing signal is small but the fix is free.
func constantTimeEquals(_ lhs: String, _ rhs: String) -> Bool {
    let a = Array(lhs.utf8)
    let b = Array(rhs.utf8)
    guard a.count == b.count else { return false }
    var difference: UInt8 = 0
    for i in 0..<a.count { difference |= a[i] ^ b[i] }
    return difference == 0
}
