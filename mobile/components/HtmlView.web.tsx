import { createElement } from "react";

// WEB: raw newsletter HTML in a sandboxed iframe (no script execution).
export default function HtmlView({ html }: { html: string }) {
  return createElement("iframe", {
    srcDoc: html,
    sandbox: "allow-same-origin allow-popups",
    style: { width: "100%", height: "100%", border: "none", background: "#fff" },
  });
}
