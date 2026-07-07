import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// Static HTML shell for web export — global CSS that RN styles can't reach.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Lore</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
  html, body {
    background-color: #FAFAF8;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior-y: none;
  }
  /* thin, unobtrusive scrollbars on desktop */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #D3D1C7; border-radius: 100px; border: 2px solid #FAFAF8; }
  ::-webkit-scrollbar-track { background: transparent; }
  /* text selection in brand teal */
  ::selection { background: #E1F5EE; color: #0F6E56; }
`;
