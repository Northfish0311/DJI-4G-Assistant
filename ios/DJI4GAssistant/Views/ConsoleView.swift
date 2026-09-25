import SwiftUI
import WebKit

struct ConsoleView: View {
    @EnvironmentObject private var pairingStore: PairingStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var reloadID = UUID()
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var retryCount = 0
    @State private var confirmingForget = false

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
                        errorMessage: $loadError,
                        retryCount: $retryCount
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
                        Text("console.recovery_hint")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        if retryCount < 3 {
                            Label("console.auto_retry", systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption)
                        }
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
                    Label(connectionLabel, systemImage: connectionIcon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(connectionColor)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            retry()
                        } label: {
                            Label("common.reload", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) {
                            confirmingForget = true
                        } label: {
                            Label("pairing.disconnect", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel(Text("common.more"))
                }
            }
            .confirmationDialog("pairing.disconnect", isPresented: $confirmingForget, titleVisibility: .visible) {
                Button("pairing.disconnect", role: .destructive) { pairingStore.disconnect() }
                Button("common.cancel", role: .cancel) {}
            }
        }
        .task(id: loadError) {
            guard loadError != nil, retryCount < 3, scenePhase == .active else { return }
            do { try await Task.sleep(nanoseconds: UInt64(2 << retryCount) * 1_000_000_000) }
            catch { return }
            guard !Task.isCancelled, scenePhase == .active else { return }
            retryCount += 1
            reload()
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active && loadError != nil { retry() }
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

    private var connectionLabel: LocalizedStringKey {
        if loadError != nil { return "console.disconnected" }
        return isLoading ? "console.connecting_short" : "console.connected"
    }

    private var connectionIcon: String {
        if loadError != nil { return "wifi.exclamationmark" }
        return isLoading ? "arrow.triangle.2.circlepath" : "network"
    }

    private var connectionColor: Color {
        if loadError != nil { return .orange }
        return isLoading ? .secondary : .green
    }

    private func retry() {
        retryCount = 0
        reload()
    }

    private func reload() {
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
    @Binding var retryCount: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(
            allowedBaseURL: allowedBaseURL,
            isLoading: $isLoading,
            errorMessage: $errorMessage,
            retryCount: $retryCount
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.backgroundColor = UIColor.systemGroupedBackground
        webView.isOpaque = false
        webView.load(URLRequest(url: launchURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 15))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let allowedBaseURL: URL
        private var isLoading: Binding<Bool>
        private var errorMessage: Binding<String?>
        private var retryCount: Binding<Int>

        init(
            allowedBaseURL: URL,
            isLoading: Binding<Bool>,
            errorMessage: Binding<String?>,
            retryCount: Binding<Int>
        ) {
            self.allowedBaseURL = allowedBaseURL
            self.isLoading = isLoading
            self.errorMessage = errorMessage
            self.retryCount = retryCount
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading.wrappedValue = true
            errorMessage.wrappedValue = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = nil
            retryCount.wrappedValue = 0
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            if (error as NSError).code == NSURLErrorCancelled { return }
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
            if navigationAction.navigationType == .linkActivated,
               ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
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
            if let url = navigationAction.request.url, !isAllowed(url),
               ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
            return nil
        }

        private func isAllowed(_ url: URL) -> Bool {
            guard ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                  url.scheme?.lowercased() == allowedBaseURL.scheme?.lowercased(),
                  url.host?.caseInsensitiveCompare(allowedBaseURL.host ?? "") == .orderedSame else {
                return false
            }
            return effectivePort(url) == effectivePort(allowedBaseURL)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = NSLocalizedString("console.process_stopped", comment: "")
        }

        private func presenter(for webView: WKWebView) -> UIViewController? {
            guard var controller = webView.window?.rootViewController else { return nil }
            while let presented = controller.presentedViewController { controller = presented }
            return controller
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            guard let url = frame.request.url, isAllowed(url), let controller = presenter(for: webView) else {
                completionHandler(false)
                return
            }
            let alert = UIAlertController(title: NSLocalizedString("console.confirm", comment: ""), message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: NSLocalizedString("common.cancel", comment: ""), style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: NSLocalizedString("common.ok", comment: ""), style: .default) { _ in completionHandler(true) })
            controller.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard let url = frame.request.url, isAllowed(url), let controller = presenter(for: webView) else {
                completionHandler()
                return
            }
            let alert = UIAlertController(title: NSLocalizedString("app.title", comment: ""), message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: NSLocalizedString("common.ok", comment: ""), style: .default) { _ in completionHandler() })
            controller.present(alert, animated: true)
        }

        private func effectivePort(_ url: URL) -> Int? {
            if let port = url.port { return port }
            return url.scheme?.lowercased() == "https" ? 443 : 80
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            guard let url = frame.request.url, isAllowed(url), let controller = presenter(for: webView) else {
                completionHandler(nil)
                return
            }
            let alert = UIAlertController(title: NSLocalizedString("console.confirm", comment: ""), message: prompt, preferredStyle: .alert)
            alert.addTextField { field in
                field.text = defaultText
                field.autocorrectionType = .no
                field.autocapitalizationType = .none
            }
            alert.addAction(UIAlertAction(title: NSLocalizedString("common.cancel", comment: ""), style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: NSLocalizedString("common.ok", comment: ""), style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text ?? "") })
            controller.present(alert, animated: true)
        }
    }
}
