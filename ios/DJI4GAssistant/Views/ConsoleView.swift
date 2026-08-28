import SwiftUI
import WebKit

struct ConsoleView: View {
    @EnvironmentObject private var pairingStore: PairingStore
    @State private var reloadID = UUID()
    @State private var isLoading = true
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemBackground)

                if let host = pairingStore.host,
                   let token = pairingStore.token,
                   let launchURL = launchURL(host: host, token: token) {
                    WebConsoleView(
                        launchURL: launchURL,
                        allowedBaseURL: host.baseURL,
                        isLoading: $isLoading,
                        errorMessage: $loadError
                    )
                    .id(reloadID)
                }

                if isLoading && loadError == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("console.connecting")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(20)
                }

                if let loadError {
                    VStack(spacing: 14) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 34))
                            .foregroundStyle(.orange)
                        Text("console.unreachable")
                            .font(.headline)
                        Text(loadError)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 360)
                        Button {
                            retry()
                        } label: {
                            Label("common.retry", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(24)
                }
            }
            .navigationTitle(pairingStore.host?.name ?? NSLocalizedString("app.title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Label("console.local", systemImage: "lock.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.green)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            retry()
                        } label: {
                            Label("common.reload", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) {
                            pairingStore.disconnect()
                        } label: {
                            Label("pairing.disconnect", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel(Text("common.more"))
                }
            }
        }
    }

    private func launchURL(host: PairedHost, token: String) -> URL? {
        guard var components = URLComponents(
            url: host.baseURL,
            resolvingAgainstBaseURL: false
        ) else {
            return nil
        }
        var queryItems = components.queryItems ?? []
        queryItems.removeAll { ["token", "native"].contains($0.name) }
        queryItems.append(URLQueryItem(name: "token", value: token))
        queryItems.append(URLQueryItem(name: "native", value: "ios"))
        components.queryItems = queryItems
        components.fragment = "overview"
        return components.url
    }

    private func retry() {
        isLoading = true
        loadError = nil
        reloadID = UUID()
    }
}

private struct WebConsoleView: UIViewRepresentable {
    let launchURL: URL
    let allowedBaseURL: URL
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?

    func makeCoordinator() -> Coordinator {
        Coordinator(
            allowedBaseURL: allowedBaseURL,
            isLoading: $isLoading,
            errorMessage: $errorMessage
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.backgroundColor = UIColor.systemGroupedBackground
        webView.isOpaque = false
        webView.load(URLRequest(url: launchURL, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let allowedBaseURL: URL
        private var isLoading: Binding<Bool>
        private var errorMessage: Binding<String?>

        init(
            allowedBaseURL: URL,
            isLoading: Binding<Bool>,
            errorMessage: Binding<String?>
        ) {
            self.allowedBaseURL = allowedBaseURL
            self.isLoading = isLoading
            self.errorMessage = errorMessage
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading.wrappedValue = true
            errorMessage.wrappedValue = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = nil
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = error.localizedDescription
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = error.localizedDescription
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if isAllowed(url) || url.scheme == "about" {
                decisionHandler(.allow)
                return
            }
            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url, !isAllowed(url) {
                UIApplication.shared.open(url)
            }
            return nil
        }

        private func isAllowed(_ url: URL) -> Bool {
            guard ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                  url.host?.caseInsensitiveCompare(allowedBaseURL.host ?? "") == .orderedSame else {
                return false
            }
            return effectivePort(url) == effectivePort(allowedBaseURL)
        }

        private func effectivePort(_ url: URL) -> Int? {
            if let port = url.port { return port }
            return url.scheme?.lowercased() == "https" ? 443 : 80
        }
    }
}
