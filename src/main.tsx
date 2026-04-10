import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { MiniKit } from "@worldcoin/minikit-js";

const appId = import.meta.env.VITE_WORLD_APP_ID || "app_ccf542f4e61d9faa92be78b5154299b4";

console.log("[H Love] Initializing MiniKit with app_id:", appId);

MiniKit.install(appId);

console.log("[H Love] MiniKit installed:", MiniKit.isInstalled());

createRoot(document.getElementById("root")!).render(<App />);
