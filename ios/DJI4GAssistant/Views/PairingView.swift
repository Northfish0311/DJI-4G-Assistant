import SwiftUI

struct PairingView: View {
    @EnvironmentObject private var pairingStore: PairingStore
    @StateObject private var discovery = BonjourDiscovery()
    @State private var showingScanner = false
    @State private var showingManual = false
    @State private var manualURL = ""
    @State private var manualToken = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    brandHeader
                    primaryPairingSection
                    discoverySection
                    stepsSection
                    manualSection
                }
                .frame(maxWidth: 680)
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
                .frame(maxWidth: .infinity)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("app.title")
            .navigationBarTitleDisplayMode(.inline)
        }
        .fullScreenCover(isPresented: $showingScanner) {
            QRScannerSheet { code in
                guard let url = URL(string: code) else {
                    pairingStore.errorMessage = NSLocalizedString("pairing.error.invalid", comment: "")
                    return
                }
                Task {
                    await pairingStore.pair(using: url)
                }
            }
        }
        .alert("pairing.could_not_connect", isPresented: Binding(
            get: { pairingStore.errorMessage != nil },
            set: { if !$0 { pairingStore.errorMessage = nil } }
        )) {
            Button("common.ok", role: .cancel) {}
        } message: {
            Text(pairingStore.errorMessage ?? "")
        }
        .onAppear {
            discovery.start()
        }
        .onDisappear {
            discovery.stop()
        }
    }

    private var brandHeader: some View {
        HStack(spacing: 14) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 25, weight: .semibold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 58, height: 58)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text("app.title")
                    .font(.title2.bold())
                Text("pairing.subtitle")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private var primaryPairingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("pairing.ready_title", systemImage: "iphone.and.arrow.forward")
                .font(.headline)

            Text("pairing.ready_detail")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                showingScanner = true
            } label: {
                HStack {
                    if pairingStore.isPairing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "viewfinder")
                    }
                    Text(pairingStore.isPairing ? "pairing.connecting" : "pairing.scan")
                        .fontWeight(.semibold)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.bold))
                        .opacity(0.8)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .padding(.horizontal, 16)
                .foregroundStyle(.white)
                .background(Color.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(pairingStore.isPairing)
        }
        .sectionSurface()
    }

    private var discoverySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("pairing.nearby", systemImage: "desktopcomputer")
                    .font(.headline)
                Spacer()
                discoveryStatus
            }

            Divider()

            if discovery.hosts.isEmpty {
                HStack(spacing: 11) {
                    ProgressView()
                    VStack(alignment: .leading, spacing: 2) {
                        Text("pairing.searching")
                            .font(.subheadline.weight(.semibold))
                        Text("pairing.same_wifi")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .frame(minHeight: 48)
            } else {
                ForEach(Array(discovery.hosts.enumerated()), id: \.element.id) { index, host in
                    if index > 0 {
                        Divider()
                    }
                    HStack(spacing: 12) {
                        Image(systemName: "pc")
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 30)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(host.name)
                                .font(.subheadline.weight(.semibold))
                            Text(host.baseURL.absoluteString)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text("pairing.found")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.green)
                    }
                    .frame(minHeight: 44)
                }
            }
        }
        .sectionSurface()
    }

    @ViewBuilder
    private var discoveryStatus: some View {
        switch discovery.state {
        case .found:
            Label("pairing.found", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.caption.weight(.semibold))
        case .failed:
            Label("pairing.discovery_failed", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.caption.weight(.semibold))
        default:
            Text("pairing.automatic")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
    }

    private var stepsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("pairing.how_to")
                .font(.headline)
                .padding(.bottom, 11)

            instructionRow(number: "1", icon: "laptopcomputer", title: "pairing.step1.title", detail: "pairing.step1.detail")
            Divider().padding(.leading, 44)
            instructionRow(number: "2", icon: "qrcode.viewfinder", title: "pairing.step2.title", detail: "pairing.step2.detail")
            Divider().padding(.leading, 44)
            instructionRow(number: "3", icon: "checkmark.shield", title: "pairing.step3.title", detail: "pairing.step3.detail")
        }
        .sectionSurface()
    }

    private func instructionRow(
        number: String,
        icon: String,
        title: LocalizedStringKey,
        detail: LocalizedStringKey
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 32, height: 32)
                .background(Color.accentColor.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 7))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 2)

            Spacer(minLength: 0)
        }
        .padding(.vertical, 9)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("\(number). ") + Text(title) + Text(". ") + Text(detail))
    }

    private var manualSection: some View {
        DisclosureGroup(isExpanded: $showingManual) {
            VStack(spacing: 12) {
                TextField("pairing.address_placeholder", text: $manualURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                SecureField("pairing.token_placeholder", text: $manualToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task {
                        await pairingStore.pair(baseURL: manualURL, token: manualToken)
                    }
                } label: {
                    Label("pairing.connect_manually", systemImage: "link")
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.bordered)
                .disabled(pairingStore.isPairing || manualURL.isEmpty || manualToken.isEmpty)
            }
            .padding(.top, 14)
        } label: {
            Label("pairing.manual", systemImage: "keyboard")
                .font(.subheadline.weight(.semibold))
        }
        .sectionSurface()
    }
}

private extension View {
    func sectionSurface() -> some View {
        self
            .padding(16)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(uiColor: .separator).opacity(0.35), lineWidth: 0.5)
            }
    }
}
