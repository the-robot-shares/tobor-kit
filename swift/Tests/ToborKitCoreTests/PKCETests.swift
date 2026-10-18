import XCTest
@testable import ToborKitCore

final class PKCETests: XCTestCase {

    /// The worked vector from RFC 7636 Appendix B. If this ever drifts, the
    /// authorization server is the one that will notice, at token exchange,
    /// with `invalid_grant`.
    func testRFC7636AppendixBVector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        let challenge = PKCEChallenge(verifier: verifier)
        XCTAssertEqual(challenge.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        XCTAssertEqual(challenge.method, "S256")
    }

    func testVerifierAlphabetAndLength() {
        let alphabet = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        for length in [43, 64, 128] {
            let verifier = PKCEChallenge.makeVerifier(length: length)
            XCTAssertEqual(verifier.count, length)
            XCTAssertTrue(verifier.allSatisfy { alphabet.contains($0) }, "verifier has a non-RFC-7636 character")
        }
    }

    func testChallengeIsUnpaddedBase64URL() {
        let challenge = PKCEChallenge()
        XCTAssertFalse(challenge.challenge.contains("+"))
        XCTAssertFalse(challenge.challenge.contains("/"))
        XCTAssertFalse(challenge.challenge.contains("="))
    }

    func testChallengeIsDeterministicInVerifier() {
        let first = PKCEChallenge(verifier: "abc")
        let second = PKCEChallenge(verifier: "abc")
        XCTAssertEqual(first.challenge, second.challenge)
        XCTAssertNotEqual(first.challenge, PKCEChallenge(verifier: "abd").challenge)
    }

    func testPendingAuthorizationExpiry() {
        let pending = PendingAuthorization(
            redirectURI: "app://callback",
            createdAt: Date(timeIntervalSinceNow: -700)
        )
        XCTAssertTrue(pending.isExpired())
        let fresh = PendingAuthorization(redirectURI: "app://callback")
        XCTAssertFalse(fresh.isExpired())
    }

    func testConstantTimeEquals() {
        XCTAssertTrue(constantTimeEquals("state-a", "state-a"))
        XCTAssertFalse(constantTimeEquals("state-a", "state-b"))
        XCTAssertFalse(constantTimeEquals("state-a", "state-a-longer"))
        XCTAssertFalse(constantTimeEquals("", "x"))
        XCTAssertTrue(constantTimeEquals("", ""))
    }
}
