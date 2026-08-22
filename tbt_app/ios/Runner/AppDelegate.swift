import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {

  // Opaque window shown during screen recording or on screenshot.
  private var protectionWindow: UIWindow?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Screen recording: show black overlay as soon as capture starts.
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleCaptureChange),
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )

    // Screenshot: show black overlay briefly (Apple does not allow blocking).
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleScreenshot),
      name: UIApplication.userDidTakeScreenshotNotification,
      object: nil
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Screen recording

  @objc private func handleCaptureChange() {
    if UIScreen.main.isCaptured {
      showProtection(autoHide: false)
    } else {
      hideProtection()
    }
  }

  // MARK: - Screenshot

  @objc private func handleScreenshot() {
    showProtection(autoHide: true)
  }

  // MARK: - Overlay helpers

  private func showProtection(autoHide: Bool) {
    guard protectionWindow == nil else { return }

    let overlay = UIWindow(frame: UIScreen.main.bounds)
    overlay.windowLevel = UIWindow.Level.alert + 1
    overlay.backgroundColor = .black
    overlay.isUserInteractionEnabled = false

    let vc = UIViewController()
    vc.view.backgroundColor = .black

    let label = UILabel()
    label.text = "Screen capture is not allowed"
    label.textColor = UIColor(white: 0.6, alpha: 1)
    label.font = UIFont.systemFont(ofSize: 15, weight: .medium)
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    vc.view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
    ])

    overlay.rootViewController = vc
    overlay.isHidden = false
    protectionWindow = overlay

    if autoHide {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
        self?.hideProtection()
      }
    }
  }

  private func hideProtection() {
    protectionWindow?.isHidden = true
    protectionWindow = nil
  }
}
