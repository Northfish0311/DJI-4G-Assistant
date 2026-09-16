import XCTest
@testable import DJI4GAssistant

final class PairingLinkTests: XCTestCase {
    private let token = String(repeating: "a", count: 32)

    func testPrivateAddressNormalization() throws {
        let link = try PairingLink(baseURL: " http://192.168.5.6:8787/path?token=old#sms ", token: " \(token) ")
        XCTAssertEqual(link.baseURL.absoluteString, "http://192.168.5.6:8787")
        XCTAssertEqual(link.token, token)
    }

    func testQRCodeRoundTrip() throws {
        var url = URLComponents(string: "dji4g://pair")!
        url.queryItems = [URLQueryItem(name: "url", value: "http://assistant.local:8787"), URLQueryItem(name: "token", value: token)]
        let link = try PairingLink(url: XCTUnwrap(url.url))
        XCTAssertEqual(link.baseURL.host, "assistant.local")
        XCTAssertEqual(link.token, token)
    }

    func testRejectsPublicLoopbackAndCredentials() {
        for address in ["http://127.0.0.1:8787", "http://localhost:8787", "https://example.com", "http://8.8.8.8", "http://user:pass@192.168.1.1", "file:///tmp/test", "http://192.168.bad.1.2"] {
            XCTAssertThrowsError(try PairingLink(baseURL: address, token: token), address)
        }
    }

    func testRejectsInvalidPairingCodes() {
        XCTAssertThrowsError(try PairingLink(baseURL: "http://192.168.1.1", token: "short"))
        XCTAssertThrowsError(try PairingLink(url: URL(string: "https://example.com")!))
        XCTAssertThrowsError(try PairingLink(url: URL(string: "dji4g://pair?url=http%3A%2F%2F192.168.1.1")!))
    }
}
