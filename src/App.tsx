import { useState, useEffect, useRef } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";
  import LandingPage from "@/pages/LandingPage";

  function App() {
    const [userId, setUserId] = useState<string | null>(null);
    const [verified, setVerified] = useState(false);
    const [wallet, setWallet] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const walletLoading = useRef(false);

    useEffect(() => {
      const init = async () => {
        console.log("[App] Init started");
        const storedId = localStorage.getItem("hlove_user_id");
        console.log("[App] stored userId:", storedId ? storedId.slice(0, 12) + "..." : "null");

        if (storedId) {
          try {
            const checkRes = await fetch(`/api/verify?userId=${storedId}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              console.log("[App] verify check:", JSON.stringify(checkData));
              if (checkData.valid) {
                setUserId(storedId);
                setVerified(true);
                console.log("[App] ✅ Restored session");
              } else {
                console.log("[App] ❌ Stored userId invalid");
                localStorage.removeItem("hlove_user_id");
              }
            } else {
              setUserId(storedId);
              setVerified(true);
            }
          } catch (e) {
            setUserId(storedId);
            setVerified(true);
          }
        }

        setLoading(false);
      };

      init();
    }, []);

    useEffect(() => {
      const loadWallet = async () => {
        if (!verified || wallet || !MiniKit.isInstalled() || walletLoading.current) return;
        walletLoading.current = true;

        try {
          console.log("[App] Fetching /api/nonce...");
          const nonceRes = await fetch("/api/nonce");
          if (!nonceRes.ok) throw new Error("No se pudo obtener nonce");
          const { nonce } = await nonceRes.json();
          console.log("[App] Nonce:", nonce?.slice(0, 8) + "...");

          console.log("[App] Calling walletAuth...");
          const auth = await MiniKit.commandsAsync.walletAuth({
            nonce,
            requestId: "wallet-auth-" + Date.now(),
            expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            notBefore: new Date(Date.now() - 60 * 1000),
            statement: "Autenticar wallet para H Love",
          });

          const payload = auth?.finalPayload;

          if (payload?.status === "error") {
            console.warn("[App] WalletAuth error:", JSON.stringify(payload));
          } else if (payload?.address && payload?.message && payload?.signature) {
            console.log("[App] WalletAuth success, verifying...");
            const vRes = await fetch("/api/walletVerify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload, nonce, userId }),
            });
            const vData = await vRes.json();
            console.log("[App] walletVerify:", JSON.stringify(vData));
            if (vData.success) {
              setWallet(vData.address);
              console.log("[App] ✅ Wallet:", vData.address.slice(0, 10) + "...");
            }
          }
        } catch (err) {
          console.error("[App] Wallet error:", err);
        } finally {
          walletLoading.current = false;
        }
      };

      loadWallet();
    }, [verified, wallet]);

    const handleVerified = (id: string) => {
      setUserId(id);
      setVerified(true);
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
        </div>
      );
    }

    if (!verified) {
      return <LandingPage onVerified={handleVerified} />;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">💜</div>
          <h1 className="text-3xl font-bold gradient-love-text">Welcome to H Love</h1>
          <p className="text-muted-foreground">
            Verified human ✓
            {wallet && <><br />Wallet: {wallet.slice(0, 6)}...{wallet.slice(-4)}</>}
          </p>
          <p className="text-xs text-muted-foreground/60">
            ID: {userId?.slice(0, 12)}...
          </p>
        </div>
      </div>
    );
  }

  export default App;
  