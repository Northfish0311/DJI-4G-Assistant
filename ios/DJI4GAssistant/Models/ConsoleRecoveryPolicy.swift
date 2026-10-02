import Foundation

enum ConsoleRecoveryPolicy {
    struct HTTPFailure {
        let messageKey: String
        let allowsAutomaticRetry: Bool
    }

    static func retryDelay(attempt: Int, allowed: Bool) -> UInt64? {
        guard allowed, (0..<3).contains(attempt) else { return nil }
        return UInt64(2 << attempt) * 1_000_000_000
    }

    static func httpFailure(statusCode: Int) -> HTTPFailure? {
        guard statusCode >= 400 else { return nil }
        if statusCode == 401 || statusCode == 403 {
            return HTTPFailure(messageKey: "console.authorization_failed", allowsAutomaticRetry: false)
        }
        let transient = statusCode == 408 || statusCode == 429 || (500...599).contains(statusCode)
        return HTTPFailure(messageKey: "console.server_error", allowsAutomaticRetry: transient)
    }
}
