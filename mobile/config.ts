// Point this at the Mac running the sidecar.
//
// Find your Mac's LAN IP:
//   macOS: System Settings → Wi-Fi → Details → IP address
//   or terminal: ipconfig getifaddr en0
//
// The phone and the Mac must be on the same wifi network.
// Do NOT use "localhost" — on a phone that means the phone itself.
export const SIDECAR_URL = "http://192.168.1.50:8000";
