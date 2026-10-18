import Foundation

#if canImport(Security)
import Security
#endif

public struct AuthTokens: Sendable, Hashable, Codable {
    public var accessToken: String
    public var refreshToken: String?
    public var expiresAt: Date

    public init(accessToken: String, refreshToken: String? = nil, expiresAt: Date) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    /// A 30 s skew so a token that expires mid-flight is refreshed before it is
    /// used rather than after it is rejected.
    public func isExpired(at now: Date = Date(), skew: TimeInterval = 30) -> Bool {
        expiresAt.addingTimeInterval(-skew) <= now
    }
}

public protocol TokenStoring: Sendable {
    func load() throws -> AuthTokens?
    func save(_ tokens: AuthTokens) throws
    func clear() throws
}

public protocol PendingAuthorizationStoring: Sendable {
    /// Reads *and removes* the pending record. Single-use by construction: a
    /// verifier that survives its callback is a replay waiting to happen.
    func take() throws -> PendingAuthorization?
    func save(_ pending: PendingAuthorization) throws
    func clear() throws
}

// MARK: - Keychain

#if canImport(Security)

/// Keychain-backed storage. Tokens never touch `UserDefaults` — that file is
/// plain plist in the app container and is included in unencrypted backups.
public struct KeychainStore: Sendable {
    public let service: String
    public let accessGroup: String?

    public init(service: String = "com.noizu.toborkit", accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    private func query(_ account: String) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if let accessGroup { q[kSecAttrAccessGroup as String] = accessGroup }
        return q
    }

    public func set(_ account: String, _ data: Data) throws {
        SecItemDelete(query(account) as CFDictionary)
        var add = query(account)
        add[kSecValueData as String] = data
        // `AfterFirstUnlock` and not `WhenUnlocked`: a background refresh on a
        // locked device is normal, and a token the app cannot read then is a
        // token that logs the user out for no reason.
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw ToborError.keychain(status: status) }
    }

    public func get(_ account: String) throws -> Data? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        let status = SecItemCopyMatching(q as CFDictionary, &out)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw ToborError.keychain(status: status) }
        return out as? Data
    }

    public func delete(_ account: String) throws {
        let status = SecItemDelete(query(account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw ToborError.keychain(status: status)
        }
    }
}

public struct KeychainTokenStore: TokenStoring {
    private let keychain: KeychainStore
    private let account: String

    public init(keychain: KeychainStore = KeychainStore(), account: String = "tokens") {
        self.keychain = keychain
        self.account = account
    }

    public func load() throws -> AuthTokens? {
        guard let data = try keychain.get(account) else { return nil }
        return try? ToborJSON.decode(AuthTokens.self, from: data)
    }

    public func save(_ tokens: AuthTokens) throws {
        try keychain.set(account, try ToborJSON.encode(tokens))
    }

    public func clear() throws {
        try keychain.delete(account)
    }
}

public struct KeychainPendingAuthorizationStore: PendingAuthorizationStoring {
    private let keychain: KeychainStore
    private let account: String

    public init(keychain: KeychainStore = KeychainStore(), account: String = "pending-authorization") {
        self.keychain = keychain
        self.account = account
    }

    public func take() throws -> PendingAuthorization? {
        guard let data = try keychain.get(account) else { return nil }
        try keychain.delete(account)
        return try? ToborJSON.decode(PendingAuthorization.self, from: data)
    }

    public func save(_ pending: PendingAuthorization) throws {
        try keychain.set(account, try ToborJSON.encode(pending))
    }

    public func clear() throws {
        try keychain.delete(account)
    }
}

#endif

// MARK: - In-memory (tests, and hosts that manage their own persistence)

public final class InMemoryTokenStore: TokenStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var tokens: AuthTokens?

    public init(_ tokens: AuthTokens? = nil) { self.tokens = tokens }

    public func load() throws -> AuthTokens? {
        lock.lock(); defer { lock.unlock() }
        return tokens
    }

    public func save(_ tokens: AuthTokens) throws {
        lock.lock(); defer { lock.unlock() }
        self.tokens = tokens
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        tokens = nil
    }
}

public final class InMemoryPendingAuthorizationStore: PendingAuthorizationStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var pending: PendingAuthorization?

    public init(_ pending: PendingAuthorization? = nil) { self.pending = pending }

    public func take() throws -> PendingAuthorization? {
        lock.lock(); defer { lock.unlock() }
        defer { pending = nil }
        return pending
    }

    public func save(_ pending: PendingAuthorization) throws {
        lock.lock(); defer { lock.unlock() }
        self.pending = pending
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        pending = nil
    }
}
