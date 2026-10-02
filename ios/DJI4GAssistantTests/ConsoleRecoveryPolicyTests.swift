import XCTest
@testable import DJI4GAssistant

final class ConsoleRecoveryPolicyTests: XCTestCase {
    func testRetryBudgetAndDelays() {
        XCTAssertEqual(ConsoleRecoveryPolicy.retryDelay(attempt: 0, allowed: true), 2_000_000_000)
        XCTAssertEqual(ConsoleRecoveryPolicy.retryDelay(attempt: 1, allowed: true), 4_000_000_000)
        XCTAssertEqual(ConsoleRecoveryPolicy.retryDelay(attempt: 2, allowed: true), 8_000_000_000)
        XCTAssertNil(ConsoleRecoveryPolicy.retryDelay(attempt: 3, allowed: true))
        XCTAssertNil(ConsoleRecoveryPolicy.retryDelay(attempt: -1, allowed: true))
        XCTAssertNil(ConsoleRecoveryPolicy.retryDelay(attempt: 0, allowed: false))
    }

    func testAuthorizationErrorsStopAutomaticRetries() throws {
        for status in [401, 403] {
            let failure = try XCTUnwrap(ConsoleRecoveryPolicy.httpFailure(statusCode: status))
            XCTAssertEqual(failure.messageKey, "console.authorization_failed")
            XCTAssertFalse(failure.allowsAutomaticRetry)
        }
    }

    func testTransientHTTPFailuresAreRetryable() throws {
        for status in [408, 429, 500, 502, 503] {
            let failure = try XCTUnwrap(ConsoleRecoveryPolicy.httpFailure(statusCode: status))
            XCTAssertEqual(failure.messageKey, "console.server_error")
            XCTAssertTrue(failure.allowsAutomaticRetry)
        }
    }

    func testOtherClientErrorsDoNotLoop() throws {
        for status in [400, 404, 405, 422] {
            XCTAssertFalse(try XCTUnwrap(ConsoleRecoveryPolicy.httpFailure(statusCode: status)).allowsAutomaticRetry)
        }
    }

    func testSuccessfulAndRedirectResponsesAreNotHTTPFailures() {
        for status in [200, 204, 301, 302, 304] {
            XCTAssertNil(ConsoleRecoveryPolicy.httpFailure(statusCode: status))
        }
    }
}
