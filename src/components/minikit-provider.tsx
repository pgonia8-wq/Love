import { ReactNode, useEffect } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";

  export default function MiniKitProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
      const appId = import.meta.env.VITE_WORLD_APP_ID || "app_ccf542f4e61d9faa92be78b5154299b4";
      console.log("[MiniKitProvider] Installing with appId:", appId);
      const { success } = MiniKit.install(appId);
      console.log("[MiniKitProvider] install success:", success);
      console.log("[MiniKitProvider] isInstalled:", MiniKit.isInstalled());
      console.log("[MiniKitProvider] user:", JSON.stringify(MiniKit.user));
    }, []);

    return <>{children}</>;
  }
  