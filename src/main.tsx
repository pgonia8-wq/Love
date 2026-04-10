import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import MiniKitProvider from "./components/minikit-provider";
import { I18nProvider } from "./lib/i18n";

console.log("[H Love] App starting...");
console.log("[H Love] User agent:", navigator.userAgent);
console.log("[H Love] Window size:", window.innerWidth, "x", window.innerHeight);
console.log("[H Love] Device pixel ratio:", window.devicePixelRatio);

createRoot(document.getElementById("root")!).render(
  <MiniKitProvider>
    <I18nProvider>
      <App />
    </I18nProvider>
  </MiniKitProvider>
);
