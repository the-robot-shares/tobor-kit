import Foundation

/// Client-side transcript persistence for the `memory` and `local` stores.
///
/// The `backend` store never touches this protocol — it reads through
/// ``GuideClient/transcript(sessionID:limit:before:)`` instead, and a 501 from
/// that endpoint means the guide is *this* protocol's business, not an error.
public protocol TranscriptStoring: Sendable {

    /// Appends a turn, evicting the oldest when the retain cap is reached.
    func append(_ turn: Turn) throws

    /// Stored turns, oldest first.
    func turns() throws -> [Turn]

    /// Erases everything.
    func clear() throws
}

/// View-state-only store: lost when the panel goes away. This is the schema's
/// `memory` default, and it exists as a real object so the panel has one code
/// path regardless of which store the guide declared.
public final class InMemoryTranscriptStore: TranscriptStoring, @unchecked Sendable {

    private let lock = NSLock()
    private var entries: [Turn] = []
    private let retainTurns: Int

    public init(retainTurns: Int = 200) {
        self.retainTurns = max(1, retainTurns)
    }

    public func append(_ turn: Turn) throws {
        lock.lock(); defer { lock.unlock() }
        entries.append(turn)
        if entries.count > retainTurns {
            entries.removeFirst(entries.count - retainTurns)
        }
    }

    public func turns() throws -> [Turn] {
        lock.lock(); defer { lock.unlock() }
        return entries
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        entries.removeAll()
    }
}

/// On-device store for the `local` transcript setting. One JSON file, written
/// atomically — a crash mid-append must not truncate history.
public final class LocalTranscriptStore: TranscriptStoring, @unchecked Sendable {

    private let url: URL
    private let retainTurns: Int
    private let lock = NSLock()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    public init(fileURL: URL, retainTurns: Int = 200) {
        self.url = fileURL
        self.retainTurns = max(1, retainTurns)
    }

    /// Store under the host app's support directory, namespaced by guide slug.
    public static func defaultURL(slug: String) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base
            .appendingPathComponent("ToborKit", isDirectory: true)
            .appendingPathComponent("transcript-\(slug).json")
    }

    public func append(_ turn: Turn) throws {
        lock.lock(); defer { lock.unlock() }
        var entries = try readLocked()
        entries.append(turn)
        if entries.count > retainTurns {
            entries.removeFirst(entries.count - retainTurns)
        }
        try writeLocked(entries)
    }

    public func turns() throws -> [Turn] {
        lock.lock(); defer { lock.unlock() }
        return try readLocked()
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        try? FileManager.default.removeItem(at: url)
    }

    // File access happens under `lock`; helpers skip re-locking.

    private func readLocked() throws -> [Turn] {
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let data = try Data(contentsOf: url)
        if data.isEmpty { return [] }
        return try decoder.decode([Turn].self, from: data)
    }

    private func writeLocked(_ entries: [Turn]) throws {
        let directory = url.deletingLastPathComponent()
        if !FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        let data = try encoder.encode(entries)
        try data.write(to: url, options: .atomic)
    }
}
