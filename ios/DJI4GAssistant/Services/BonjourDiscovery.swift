import Foundation

struct DiscoveredHost: Identifiable, Equatable {
    let name: String
    let baseURL: URL

    var id: String { name + "|" + baseURL.absoluteString }
}

final class BonjourDiscovery: NSObject, ObservableObject {
    enum State {
        case idle
        case searching
        case found
        case failed
    }

    @Published private(set) var hosts: [DiscoveredHost] = []
    @Published private(set) var state: State = .idle

    private let browser = NetServiceBrowser()
    private var services: [String: NetService] = [:]

    override init() {
        super.init()
        browser.delegate = self
        browser.includesPeerToPeer = true
    }

    func start() {
        guard state != .searching else { return }
        state = .searching
        browser.searchForServices(ofType: "_dji4g._tcp.", inDomain: "local.")
    }

    func stop() {
        browser.stop()
        services.values.forEach { $0.stop() }
        services.removeAll()
        if hosts.isEmpty {
            state = .idle
        }
    }

    private func resolve(_ service: NetService) {
        service.delegate = self
        service.includesPeerToPeer = true
        services[service.name] = service
        service.resolve(withTimeout: 6)
    }

    private func discoveredURL(for service: NetService) -> URL? {
        if let txtData = service.txtRecordData() {
            let values = NetService.dictionary(fromTXTRecord: txtData)
            if let urlData = values["url"],
               let urlString = String(data: urlData, encoding: .utf8),
               let url = URL(string: urlString) {
                return url
            }
        }

        guard let hostName = service.hostName?.trimmingCharacters(in: CharacterSet(charactersIn: ".")),
              service.port > 0 else {
            return nil
        }
        var components = URLComponents()
        components.scheme = "http"
        components.host = hostName
        components.port = service.port
        return components.url
    }

    private func upsert(_ service: NetService) {
        guard let url = discoveredURL(for: service) else { return }
        let host = DiscoveredHost(name: service.name, baseURL: url)
        DispatchQueue.main.async {
            self.hosts.removeAll { $0.name == service.name }
            self.hosts.append(host)
            self.hosts.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            self.state = .found
        }
    }
}

extension BonjourDiscovery: NetServiceBrowserDelegate {
    func netServiceBrowser(
        _ browser: NetServiceBrowser,
        didFind service: NetService,
        moreComing: Bool
    ) {
        resolve(service)
    }

    func netServiceBrowser(
        _ browser: NetServiceBrowser,
        didRemove service: NetService,
        moreComing: Bool
    ) {
        services[service.name]?.stop()
        services.removeValue(forKey: service.name)
        DispatchQueue.main.async {
            self.hosts.removeAll { $0.name == service.name }
            self.state = self.hosts.isEmpty ? .searching : .found
        }
    }

    func netServiceBrowser(
        _ browser: NetServiceBrowser,
        didNotSearch errorDict: [String: NSNumber]
    ) {
        DispatchQueue.main.async {
            self.state = .failed
        }
    }
}

extension BonjourDiscovery: NetServiceDelegate {
    func netServiceDidResolveAddress(_ sender: NetService) {
        upsert(sender)
    }

    func netService(_ sender: NetService, didUpdateTXTRecord data: Data) {
        upsert(sender)
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        services.removeValue(forKey: sender.name)
        DispatchQueue.main.async {
            if self.hosts.isEmpty {
                self.state = .searching
            }
        }
    }
}
