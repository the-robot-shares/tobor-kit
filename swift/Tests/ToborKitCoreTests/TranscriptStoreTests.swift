import XCTest
@testable import ToborKitCore

final class TranscriptStoreTests: XCTestCase {

    private func turn(_ content: String) -> Turn {
        Turn(id: UUID(), role: .assistant, content: content, createdAt: Date())
    }

    private func populate(_ store: any TranscriptStoring, count: Int) throws {
        for index in 0..<count {
            try store.append(turn("t\(index)"))
        }
    }

    func testMemoryStoreRetainsOrderAndCaps() throws {
        let store = InMemoryTranscriptStore(retainTurns: 5)
        try populate(store, count: 8)
        let turns = try store.turns()
        XCTAssertEqual(turns.count, 5)
        // The oldest were evicted, the order preserved.
        XCTAssertEqual(turns.map(\.content), ["t3", "t4", "t5", "t6", "t7"])
    }

    func testMemoryStoreClear() throws {
        let store = InMemoryTranscriptStore()
        try populate(store, count: 3)
        try store.clear()
        XCTAssertTrue(try store.turns().isEmpty)
    }

    func testLocalStoreRoundTrip() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("toborkit-tests-\(UUID().uuidString)")
            .appendingPathComponent("transcript.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let store = LocalTranscriptStore(fileURL: url, retainTurns: 200)
        try populate(store, count: 3)

        // A second instance over the same file sees the same history — that is
        // what makes it the `local` store rather than view state.
        let reopened = LocalTranscriptStore(fileURL: url, retainTurns: 200)
        XCTAssertEqual(try reopened.turns().map(\.content), ["t0", "t1", "t2"])

        try reopened.clear()
        XCTAssertTrue(try LocalTranscriptStore(fileURL: url).turns().isEmpty)
    }

    func testLocalStoreCaps() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("toborkit-tests-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let store = LocalTranscriptStore(fileURL: url, retainTurns: 4)
        try populate(store, count: 6)
        XCTAssertEqual(try store.turns().map(\.content), ["t2", "t3", "t4", "t5"])
    }
}
