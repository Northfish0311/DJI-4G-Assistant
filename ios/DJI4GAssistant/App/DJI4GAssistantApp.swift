import SwiftUI

@main
struct DJI4GAssistantApp: App {
    @StateObject private var pairingStore = PairingStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(pairingStore)
                .onOpenURL { url in
                    Task {
                        await pairingStore.pair(using: url)
                    }
                }
        }
    }
}

private struct RootView: View {
    @EnvironmentObject private var pairingStore: PairingStore

    var body: some View {
        Group {
            if pairingStore.host != nil, pairingStore.token != nil {
                ConsoleView()
            } else {
                PairingView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: pairingStore.host)
    }
}
