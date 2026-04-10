import { useState } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Crown, Heart, Sparkles, Zap, Shield, X } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { useI18n } from "@/lib/i18n";
  import { MiniKit, tokenToDecimals, Tokens } from "@worldcoin/minikit-js";

  interface PremiumModalProps {
    open: boolean;
    onClose: () => void;
    userId: string;
    onPurchased: () => void;
  }

  const RECIPIENT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  export default function PremiumModal({ open, onClose, userId, onPurchased }: PremiumModalProps) {
    const { t } = useI18n();
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async (currency: "USDC" | "WLD") => {
      if (!MiniKit.isInstalled()) { setError("Open in World App"); return; }
      setPaying(true);
      setError(null);

      try {
        const reference = "hlove_premium_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        const amount = currency === "USDC" ? "9.99" : "3.5";

        const payload = {
          reference,
          to: RECIPIENT_ADDRESS,
          tokens: [{
            symbol: currency === "USDC" ? Tokens.USDC : Tokens.WLD,
            token_amount: tokenToDecimals(parseFloat(amount), currency === "USDC" ? Tokens.USDC : Tokens.WLD).toString(),
          }],
          description: "H Love Premium - 1 Month",
        };

        console.log("[Pay] Initiating:", JSON.stringify(payload));
        const result = await MiniKit.commandsAsync.pay(payload);
        console.log("[Pay] Result:", JSON.stringify(result?.finalPayload));

        if (!result?.finalPayload || (result.finalPayload as any).status === "error") {
          setError("Payment cancelled");
          return;
        }

        const txId = (result.finalPayload as any).transaction_id || reference;

        const res = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            payment_type: "subscription",
            currency,
            amount: parseFloat(amount),
            tx_id: txId,
            reference,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onPurchased();
        } else {
          setError(data.error || "Payment confirmation failed");
        }
      } catch (err) {
        console.error("[Pay] Error:", err);
        setError(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setPaying(false);
      }
    };

    return (
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full shadow-2xl border border-border/50 max-h-[90vh] overflow-auto"
            >
              <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>

              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-love-gold to-love-pink flex items-center justify-center mx-auto mb-5 shadow-xl">
                <Crown className="w-10 h-10 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-center mb-1">{t("premium.unlock")}</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">{t("premium.description")}</p>

              <div className="space-y-2.5 mb-6">
                {[
                  { icon: Heart, text: t("premium.unlimitedLikes"), color: "text-love-pink" },
                  { icon: Sparkles, text: t("premium.seeWhoLiked"), color: "text-love-gold" },
                  { icon: Zap, text: t("premium.freeBoost"), color: "text-love-purple" },
                  { icon: Shield, text: t("premium.priorityFeed"), color: "text-green-500" },
                ].map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl">
                    <f.icon className={"w-5 h-5 " + f.color} />
                    <span className="text-sm font-medium">{f.text}</span>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-3">
                <Button className="w-full h-13 bg-gradient-to-r from-love-gold to-love-pink border-0 rounded-xl font-semibold text-base text-white shadow-lg" onClick={() => handlePay("USDC")} disabled={paying}>
                  {paying ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <><Crown className="w-5 h-5 mr-2" />{t("premium.upgrade")}</>}
                </Button>
                <Button variant="outline" className="w-full h-11 rounded-xl text-sm" onClick={() => handlePay("WLD")} disabled={paying}>
                  <Sparkles className="w-4 h-4 mr-2 text-love-gold" />
                  {t("premium.orWLD")} — 3.5 WLD
                </Button>
              </div>

              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-destructive text-center">{error}</motion.p>}
              </AnimatePresence>

              <button onClick={onClose} className="w-full mt-3 text-xs text-muted-foreground text-center py-2">{t("premium.maybeLater")}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  