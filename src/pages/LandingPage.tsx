import { useState } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Shield, Heart, Sparkles, Users, CheckCircle } from "lucide-react";
  import {
    MiniKit,
    type ISuccessResult,
  } from "@worldcoin/minikit-js";
  import { VERIFY_ACTION } from "@/lib/constants";

  interface LandingPageProps {
    onVerified: (userId: string) => void;
  }

  export default function LandingPage({ onVerified }: LandingPageProps) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const handleVerify = async () => {
      setIsPending(true);
      setError(null);
      setStatusMsg("Checking MiniKit...");
      console.log("[Landing] handleVerify started");
      console.log("[Landing] MiniKit.isInstalled():", MiniKit.isInstalled());
      console.log("[Landing] MiniKit version:", (MiniKit as any).version || "unknown");

      if (!MiniKit.isInstalled()) {
        console.error("[Landing] MiniKit NOT installed");
        setError("Abre esta app dentro de World App");
        setIsPending(false);
        return;
      }

      try {
        setStatusMsg("Requesting World ID verification...");
        console.log("[Landing] Calling MiniKit.commandsAsync.verify with action:", VERIFY_ACTION);

        const verifyResult = await MiniKit.commandsAsync.verify({
          action: VERIFY_ACTION,
          verification_level: "orb" as any,
        });

        console.log("[Landing] verify result:", JSON.stringify(verifyResult));
        const finalPayload = verifyResult?.finalPayload;
        console.log("[Landing] finalPayload:", JSON.stringify(finalPayload));

        if (!finalPayload || finalPayload.status === "error") {
          console.error("[Landing] Verification failed or cancelled:", JSON.stringify(finalPayload));
          setError("Verificación cancelada o fallida");
          setIsPending(false);
          return;
        }

        const successPayload = finalPayload as ISuccessResult;
        const walletAddress = (MiniKit as any).walletAddress || "";
        console.log("[Landing] successPayload.nullifier_hash:", successPayload.nullifier_hash);
        console.log("[Landing] walletAddress from MiniKit:", walletAddress);

        setStatusMsg("Sending to backend...");
        console.log("[Landing] Posting to /api/verify...");

        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: successPayload,
            action: VERIFY_ACTION,
            wallet_address: walletAddress,
            username: (MiniKit as any).user?.username || "",
          }),
        });

        console.log("[Landing] /api/verify POST status:", res.status);
        const data = await res.json();
        console.log("[Landing] /api/verify POST response:", JSON.stringify(data));

        if (!res.ok || !data.success) {
          console.error("[Landing] Backend rejected:", data.error);
          setError(data.error || "Error en la verificación");
          setIsPending(false);
          return;
        }

        const userId = data.nullifier_hash || data.wallet_address || walletAddress;
        console.log("[Landing] Verification SUCCESS! userId:", userId);
        console.log("[Landing] wallet_address:", data.wallet_address, "nullifier_hash:", data.nullifier_hash);

        setStatusMsg("Redirecting...");
        localStorage.setItem("hlove_user_id", userId);
        onVerified(userId);
      } catch (err) {
        console.error("[Landing] Exception:", err);
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setIsPending(false);
        setStatusMsg(null);
      }
    };

    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "25%", left: -80, width: 288, height: 288, background: "rgba(236,72,153,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
          <div style={{ position: "absolute", bottom: "25%", right: -80, width: 320, height: 320, background: "rgba(168,85,247,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 400, width: "100%" }}>

          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="gradient-love animate-pulse-glow"
            style={{ width: 80, height: 80, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Heart style={{ width: 40, height: 40, color: "#fff" }} fill="white" />
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="gradient-love-text" style={{ fontSize: 40, fontWeight: 700, marginBottom: 8, letterSpacing: -1 }}>
            H Love
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            style={{ color: "#888", fontSize: 16, textAlign: "center", marginBottom: 32, lineHeight: 1.5 }}>
            Real humans. Real connections.<br />
            <span style={{ color: "rgba(255,255,255,0.8)" }}>Verified by World ID.</span>
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {[
              { icon: Shield, text: "100% Orb-verified humans only", color: "#ec4899" },
              { icon: Sparkles, text: "Premium connections, zero bots", color: "#a855f7" },
              { icon: Users, text: "Exclusive events & meetups", color: "#f59e0b" },
              { icon: CheckCircle, text: "Safe, respectful community", color: "#f43f5e" },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.1 }}
                style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <item.icon style={{ width: 20, height: 20, color: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.9)" }}>{item.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
            style={{ width: "100%" }}>
            <button onClick={handleVerify} disabled={isPending}
              className="gradient-love"
              style={{ width: "100%", height: 56, fontSize: 18, fontWeight: 600, border: "none", borderRadius: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", opacity: isPending ? 0.7 : 1 }}>
              {isPending ? (
                <>
                  <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  {statusMsg && <span style={{ fontSize: 14 }}>{statusMsg}</span>}
                </>
              ) : (
                <><Shield style={{ width: 20, height: 20 }} /> Verify with World ID</>
              )}
            </button>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: 16, fontSize: 14, color: "#ef4444", textAlign: "center" }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
            style={{ marginTop: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
            Requires World App with Orb verification
          </motion.p>
        </motion.div>
      </div>
    );
  }
  