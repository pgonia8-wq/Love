import { useState, useEffect } from "react";
  import { motion } from "framer-motion";
  import { Heart, Shield, Star, Users, Sparkles, AlertCircle } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { useI18n, LanguageSelector } from "@/lib/i18n";
  import { MiniKit } from "@worldcoin/minikit-js";

  interface LandingPageProps {
    onVerified: (wallet: string, nullifier: string, username: string | null) => void;
  }

  export default function LandingPage({ onVerified }: LandingPageProps) {
    const { t } = useI18n();
    const [step, setStep] = useState<"idle" | "wallet" | "verifying" | "saving">("idle");
    const [error, setError] = useState<string | null>(null);
    const [isMiniKit, setIsMiniKit] = useState(false);

    useEffect(() => {
      const check = () => setIsMiniKit(MiniKit.isInstalled());
      check();
      const interval = setInterval(check, 500);
      setTimeout(() => clearInterval(interval), 5000);
      return () => clearInterval(interval);
    }, []);

    const handleVerify = async () => {
      if (!MiniKit.isInstalled()) {
        setError(t("landing.openInWorldApp"));
        return;
      }
      setError(null);
      setStep("wallet");

      try {
        let walletAddress = "";
        let username: string | null = null;

        try {
          const walletAuthRes = await MiniKit.commandsAsync.walletAuth({ nonce: Date.now().toString(), statement: "Sign in to H Love" });
          console.log("[Landing] walletAuth:", JSON.stringify(walletAuthRes?.finalPayload));
          if (walletAuthRes?.finalPayload) {
            walletAddress = (walletAuthRes.finalPayload as any).address || "";
            username = (walletAuthRes.finalPayload as any).username || null;
          }
        } catch (e) {
          console.warn("[Landing] walletAuth fallback:", e);
        }

        if (!walletAddress) {
          try {
            walletAddress = (MiniKit as any).user?.walletAddress || "";
            username = (MiniKit as any).user?.username || null;
          } catch {}
        }

        if (!walletAddress) {
          setError(t("landing.walletError"));
          setStep("idle");
          return;
        }

        console.log("[Landing] Wallet:", walletAddress, "Username:", username);
        setStep("verifying");

        const verifyPayload = {
          action: "verifica-que-eres-humano",
          verification_level: "orb",
        };

        const verifyRes = await MiniKit.commandsAsync.verify(verifyPayload);
        console.log("[Landing] verify:", JSON.stringify(verifyRes?.finalPayload));

        if (!verifyRes?.finalPayload || (verifyRes.finalPayload as any).status === "error") {
          setError(t("landing.verifyCancelled"));
          setStep("idle");
          return;
        }

        setStep("saving");
        const payload = verifyRes.finalPayload as any;

        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proof: payload.proof,
            merkle_root: payload.merkle_root,
            nullifier_hash: payload.nullifier_hash,
            verification_level: payload.verification_level || "orb",
            action: "verifica-que-eres-humano",
            wallet_address: walletAddress,
            username: username || undefined,
          }),
        });

        const data = await response.json();
        console.log("[Landing] backend:", JSON.stringify(data));

        if (!response.ok || !data.success) {
          setError(data.error || t("landing.backendError"));
          setStep("idle");
          return;
        }

        const returnedWallet = data.wallet_address || walletAddress;
        localStorage.setItem("hlove_wallet", returnedWallet);
        localStorage.setItem("hlove_nullifier", payload.nullifier_hash);
        if (username) localStorage.setItem("hlove_username", username);

        onVerified(returnedWallet, payload.nullifier_hash, username);
      } catch (err) {
        console.error("[Landing] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStep("idle");
      }
    };

    const features = [
      { icon: Shield, text: t("landing.feature1") },
      { icon: Star, text: t("landing.feature2") },
      { icon: Users, text: t("landing.feature3") },
      { icon: Heart, text: t("landing.feature4") },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
        <div className="absolute top-4 right-4 z-40"><LanguageSelector /></div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-love-pink/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-love-purple/5 blur-3xl" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.8, delay: 0.2 }} className="mb-8">
            <div className="w-24 h-24 rounded-3xl gradient-love flex items-center justify-center shadow-2xl shadow-love-pink/30">
              <Heart className="w-12 h-12 text-white" fill="white" />
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-4xl font-bold gradient-love-text mb-3">
            {t("landing.title")}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="text-center text-muted-foreground max-w-xs mb-2">
            {t("landing.subtitle")}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="text-xs text-love-gold font-medium flex items-center gap-1 mb-8">
            <Sparkles className="w-3 h-3" />{t("landing.subtitle2")}
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="w-full max-w-xs space-y-3 mb-8">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + i * 0.1 }} className="flex items-center gap-3 px-4 py-2.5 bg-card/50 rounded-xl border border-border/30">
                <f.icon className="w-4 h-4 text-love-pink shrink-0" />
                <span className="text-sm text-foreground/80">{f.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="w-full max-w-xs">
            <Button onClick={handleVerify} disabled={step !== "idle"} className="w-full h-14 gradient-love border-0 rounded-2xl text-white font-semibold text-base shadow-xl shadow-love-pink/20">
              {step === "idle" && (<><Shield className="w-5 h-5 mr-2" />{t("landing.verify")}</>)}
              {step === "wallet" && (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{t("landing.authenticating")}</>)}
              {step === "verifying" && (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{t("landing.verifying")}</>)}
              {step === "saving" && (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{t("landing.saving")}</>)}
            </Button>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 text-destructive text-sm max-w-xs text-center">
              <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
            </motion.div>
          )}

          <p className="mt-6 text-[10px] text-muted-foreground/60 text-center">
            {t("landing.requires")}
          </p>
        </div>
      </div>
    );
  }
  