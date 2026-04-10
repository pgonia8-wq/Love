import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import MiniKitProvider from "./components/minikit-provider";

console.log("[H Love] App starting...");

createRoot(document.getElementById("root")!).render(
  <MiniKitProvider>
    <App />
  </MiniKitProvider>
);
