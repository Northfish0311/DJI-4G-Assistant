import Foundation
import Security

struct PairedHost: Codable, Equatable, Identifiable {
    let name: String
    let baseURL: URL

    var id: String { baseURL.absoluteString }
}

private struct PairingAPIResponse: Decodable {
    let ok: Bool
    let name: String?
    let error: String?
}

enum PairingFailure: LocalizedError {
    case invalidLink
    case nonLocalHost
    case server(String)
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidLink:
            return NSLocalizedString("pairing.error.invalid", comment: "")
        case .nonLocalHost:
            return NSLocalizedString("pairing.error.local_only", comment: "")
        case .server(let detail):
            return String(
                format: NSLocalizedString("pairing.error.server", comment: ""),
                detail
            )
        case .keychain(let status):
            return String(
                format: NSLocalizedString("pairing.error.keychain", comment: ""),
                status
            )
        }
    }
}

struct PairingLink {
    let baseURL: URL
    let token: String

    init(url: URL) throws {
        guard url.scheme?.lowercased() == "dji4g",
              url.host?.lowercased() == "pair",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let rawURL = components.queryItems?.first(where: { $0.name == "url" })?.value,
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              token.count >= 20 else {
            throw PairingFailure.invalidLink
        }
        self.baseURL = try Self.normalizeBaseURL(rawURL)
        self.token = token
    }

    init(baseURL: String, token: String) throws {
        guard token.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20 else {
            throw PairingFailure.invalidLink
        }
        self.baseURL = try Self.normalizeBaseURL(baseURL)
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizeBaseURL(_ rawValue: String) throws -> URL {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(string: trimmed),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.user == nil,
              components.password == nil,
              let host = components.host,
              host.isPrivateNetworkHost else {
            throw PairingFailure.nonLocalHost
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        guard let url = components.url else {
            throw PairingFailure.invalidLink
        }
        return url
    }
}

private extension String {
    var isPrivateNetworkHost: Bool {
        let value = lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        if value.hasSuffix(".local") { return true }
        if value.contains(":") {
            return value.hasPrefix("fe80:") || value.hasPrefix("fc") || value.hasPrefix("fd")
        }

        let octets = value.split(separator: ".").compactMap { Int($0) }
        guard octets.count == 4, octets.allSatisfy({ (0...255).contains($0) }) else {
            return false
        }
        if octets[0] == 10 { return true }
        if octets[0] == 172 && (16...31).contains(octets[1]) { return true }
        if octets[0] == 192 && octets[1] == 168 { return true }
        if octets[0] == 169 && octets[1] == 254 { return true }
        if octets[0] == 100 && (64...127).contains(octets[1]) { return true }
        return false
    }
}

actor PairingValidator {
    func validate(_ link: PairingLink) async throws -> PairedHost {
        let endpoint = link.baseURL.appendingPathComponent("api/pairing")
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 12
        request.setValue(link.token, forHTTPHeaderField: "X-Console-Token")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PairingFailure.server(NSLocalizedString("pairing.error.no_response", comment: ""))
        }

        let payload = try? JSONDecoder().decode(PairingAPIResponse.self, from: data)
        guard (200..<300).contains(httpResponse.statusCode), payload?.ok == true else {
            let detail = payload?.error ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw PairingFailure.server(detail)
        }

        let fallbackName = link.baseURL.host ?? NSLocalizedString("pairing.windows_host", comment: "")
        return PairedHost(name: payload?.name ?? fallbackName, baseURL: link.baseURL)
    }
}

private enum KeychainStore {
    private static let service = "com.northfish0311.dji4gassistant"
    private static let account = "console-token"

    static func save(_ token: String) throws {
        remove()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: Data(token.utf8),
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw PairingFailure.keychain(status)
        }
    }

    static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func remove() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

@MainActor
final class PairingStore: ObservableObject {
    @Published private(set) var host: PairedHost?
    @Published private(set) var isPairing = false
    @Published var errorMessage: String?

    private let defaults = UserDefaults.standard
    private let validator = PairingValidator()
    private let hostKey = "pairedHost"

    var token: String? { KeychainStore.load() }

    init() {
        guard let data = defaults.data(forKey: hostKey),
              let savedHost = try? JSONDecoder().decode(PairedHost.self, from: data),
              KeychainStore.load() != nil else {
            return
        }
        host = savedHost
    }

    func pair(using url: URL) async {
        do {
            let link = try PairingLink(url: url)
            try await completePairing(link)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pair(baseURL: String, token: String) async {
        do {
            let link = try PairingLink(baseURL: baseURL, token: token)
            try await completePairing(link)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func disconnect() {
        host = nil
        defaults.removeObject(forKey: hostKey)
        KeychainStore.remove()
    }

    private func completePairing(_ link: PairingLink) async throws {
        isPairing = true
        errorMessage = nil
        defer { isPairing = false }

        let verifiedHost = try await validator.validate(link)
        try KeychainStore.save(link.token)
        defaults.set(try JSONEncoder().encode(verifiedHost), forKey: hostKey)
        host = verifiedHost
    }
}
