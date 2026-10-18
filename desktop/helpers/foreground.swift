import AppKit
import Foundation

// Application identity only. No AX, screen capture, Apple Events, window titles or input hooks.
func emitForeground() {
    guard let app = NSWorkspace.shared.frontmostApplication,
          let name = app.localizedName,
          let bundleID = app.bundleIdentifier else { return }
    let record: [String: String] = ["name": name, "bundleId": bundleID]
    guard let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]),
          let json = String(data: data, encoding: .utf8) else { return }
    print(json)
    fflush(stdout)
}

emitForeground()
let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in emitForeground() }
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
