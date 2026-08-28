import AVFoundation
import SwiftUI

struct QRScannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?
    let onCode: (String) -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            QRScannerView(
                onCode: { code in
                    dismiss()
                    onCode(code)
                },
                onError: { message in
                    errorMessage = message
                }
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.headline)
                            .frame(width: 38, height: 38)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel(Text("common.close"))

                    Spacer()

                    Text("scanner.title")
                        .font(.headline)
                        .padding(.horizontal, 14)
                        .frame(height: 38)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Spacer()

                    Color.clear.frame(width: 38, height: 38)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.top, 8)

                Spacer()

                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white, lineWidth: 2)
                    .frame(width: 250, height: 250)
                    .overlay(alignment: .bottom) {
                        Text("scanner.hint")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .offset(y: 64)
                    }

                Spacer()
            }
        }
        .alert("scanner.unavailable", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("common.close") {
                dismiss()
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }
}

private struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    let onError: (String) -> Void

    func makeUIViewController(context: Context) -> QRScannerViewController {
        let controller = QRScannerViewController()
        controller.onCode = onCode
        controller.onError = onError
        return controller
    }

    func updateUIViewController(_ uiViewController: QRScannerViewController, context: Context) {}
}

private final class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    var onError: ((String) -> Void)?

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.northfish0311.dji4gassistant.camera")
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var hasDeliveredCode = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        prepareCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionQueue.async { [session] in
            if session.isRunning {
                session.stopRunning()
            }
        }
    }

    private func prepareCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.configureSession()
                    } else {
                        self?.reportCameraUnavailable()
                    }
                }
            }
        default:
            reportCameraUnavailable()
        }
    }

    private func configureSession() {
        guard let camera = AVCaptureDevice.default(for: .video) else {
            reportCameraUnavailable()
            return
        }

        do {
            let input = try AVCaptureDeviceInput(device: camera)
            let metadataOutput = AVCaptureMetadataOutput()

            session.beginConfiguration()
            guard session.canAddInput(input), session.canAddOutput(metadataOutput) else {
                session.commitConfiguration()
                reportCameraUnavailable()
                return
            }
            session.addInput(input)
            session.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
            metadataOutput.metadataObjectTypes = [.qr]
            session.commitConfiguration()

            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.insertSublayer(layer, at: 0)
            previewLayer = layer

            sessionQueue.async { [session] in
                session.startRunning()
            }
        } catch {
            onError?(error.localizedDescription)
        }
    }

    private func reportCameraUnavailable() {
        onError?(NSLocalizedString("scanner.permission_error", comment: ""))
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard !hasDeliveredCode,
              let code = (metadataObjects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else {
            return
        }
        hasDeliveredCode = true
        sessionQueue.async { [session] in
            if session.isRunning {
                session.stopRunning()
            }
        }
        onCode?(code)
    }
}
