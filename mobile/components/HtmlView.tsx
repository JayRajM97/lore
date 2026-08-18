import { WebView } from "react-native-webview";

// NATIVE: render raw newsletter HTML in a WebView (scripts off, scrollable).
// Web resolves HtmlView.web.tsx (sandboxed iframe) instead.
export default function HtmlView({ html }: { html: string }) {
  return (
    <WebView
      originWhitelist={["about:blank"]}
      source={{ html }}
      javaScriptEnabled={false}
      style={{ flex: 1, backgroundColor: "#fff" }}
      // Newsletters are designed for ~600px; keep them readable on phones.
      scalesPageToFit
      showsVerticalScrollIndicator={false}
    />
  );
}
