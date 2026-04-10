import { ReactNode, useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export default function MiniKitProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const appId = import.meta.env.VITE_WORLD_APP_ID || "app_ccf542f4e61d9faa92be78b5154299b4";
    console.log("[MiniKitProvider] Installing with appId:", appId);

    try {
      MiniKit.install(appId);
      console.log("[MiniKitProvider] isInstalled:", MiniKit.isInstalled());
      console.log("[MiniKitProvider] walletAddress:", (MiniKit as any).walletAddress);
      console.log("[MiniKitProvider] user:", JSON.stringify((MiniKit as any).user));
    } catch (err) {
      console.error("[MiniKitProvider] Install error:", err);
    }

    setReady(true);
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
