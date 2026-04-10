import { useState, useEffect, useCallback } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Sparkles, Heart, Crown, Clock, Lock, Zap, Star, Users, MessageCircle, Timer, Shield, TrendingUp } from "lucide-react";
  import { useI18n } from "@/lib/i18n";
  import { Button } from "@/components/ui/button";

  // SPOTLIGHT BANNER
  interface SpotlightBannerProps {
    isPremium: boolean;
    onUpgrade: () => void;
  }

  export function SpotlightBanner({ isPremium, onUpgrade }: SpotlightBannerProps) {
    const { t } = useI18n();
    const [spotlight, setSpotlight] = useState<{ is_active: boolean; next?: { starts_at: string } } | null>(null);
    const [countdown, setCountdown] = useState("");

    useEffect(() => {
      const check = async () => {
        try {
          const r = await fetch("/api/fomo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "spotlight-status" }) });
          const data = await r.json();
          setSpotlight(data);
        } catch {}
      };
      check();
      const interval = setInterval(check, 60000);
      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      if (!spotlight?.next?.starts_at) return;
      const update = () => {
        const diff = new Date(spotlight.next!.starts_at).getTime() - Date.now();
        if (diff <= 0) { setCountdown("NOW!"); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setCountdown(h > 0 ? h + "h " + m + "m" : m + "m");
      };
      update();
      const interval = setInterval(update, 30000);
      return () => clearInterval(interval);
    }, [spotlight?.next?.starts_at]);

    if (!spotlight) return null;

    if (spotlight.is_active) {
      return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-3 p-3 rounded-2xl bg-gradient-to-r from-love-gold/20 to-love-pink/20 border border-love-gold/30">
          <div className="flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Sparkles className="w-5 h-5 text-love-gold" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-love-gold">{t("fomo.spotlightActive")}</p>
              <p className="text-[10px] text-muted-foreground">{t("fomo.spotlightActiveDesc")}</p>
            </div>
            <div className="flex items-center gap-1 bg-love-gold/20 rounded-full px-2 py-1">
              <Zap className="w-3 h-3 text-love-gold" />
              <span className="text-[10px] font-bold text-love-gold">3x</span>
            </div>
          </div>
        </motion.div>
      );
    }

    if (spotlight.next && countdown) {
      return (
        <div className="mx-4 mb-3 p-2.5 rounded-xl bg-muted/30 border border-border/30 flex items-center gap-2">
          <Timer className="w-4 h-4 text-love-gold" />
          <span className="text-xs text-muted-foreground">{t("fomo.nextSpotlight")}</span>
          <span className="text-xs font-bold text-love-gold ml-auto">{countdown}</span>
          {!isPremium && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
      );
    }

    return null;
  }

  // ANONYMOUS CRUSH BUTTON
  interface CrushButtonProps {
    userId: string;
    targetId: string;
    isPremium: boolean;
    onUpgrade: () => void;
  }

  export function CrushButton({ userId, targetId, isPremium, onUpgrade }: CrushButtonProps) {
    const { t } = useI18n();
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendCrush = async () => {
      setSending(true);
      setError(null);
      try {
        const r = await fetch("/api/fomo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send-crush", sender_id: userId, target_id: targetId }),
        });
        const data = await r.json();
        if (data.success) { setSent(true); }
        else if (data.limit_reached) { onUpgrade(); }
        else { setError(data.error); }
      } catch { setError("Failed"); }
      setSending(false);
    };

    if (sent) {
      return (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-love-purple text-[10px] font-medium">
          <Heart className="w-3 h-3" fill="currentColor" />
          {t("fomo.crushSent")}
        </motion.div>
      );
    }

    return (
      <button onClick={sendCrush} disabled={sending} className="flex items-center gap-1 bg-love-purple/10 hover:bg-love-purple/20 border border-love-purple/20 rounded-full px-2 py-0.5 transition-colors">
        <Heart className="w-3 h-3 text-love-purple" />
        <span className="text-[10px] font-medium text-love-purple">{t("fomo.sendCrush")}</span>
      </button>
    );
  }

  // CRUSH RECEIVED COUNTER (FOMO)
  export function CrushCounter({ count, onClick }: { count: number; onClick: () => void }) {
    const { t } = useI18n();
    if (count === 0) return null;

    return (
      <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={onClick}
        className="flex items-center gap-1.5 bg-love-purple/10 border border-love-purple/30 rounded-full px-3 py-1.5">
        <Heart className="w-3.5 h-3.5 text-love-purple" fill="currentColor" />
        <span className="text-xs font-semibold text-love-purple">{count} {t("fomo.secretCrushes")}</span>
        <Lock className="w-3 h-3 text-love-purple/60" />
      </motion.button>
    );
  }

  // WEEKLY TOP 5 SECTION
  interface Top5Props {
    userId: string;
    isPremium: boolean;
    onUpgrade: () => void;
  }

  export function WeeklyTop5({ userId, isPremium, onUpgrade }: Top5Props) {
    const { t } = useI18n();
    const [top5, setTop5] = useState<any[]>([]);
    const [scores, setScores] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const load = async () => {
        try {
          const r = await fetch("/api/fomo", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "weekly-top5", user_id: userId }),
          });
          const data = await r.json();
          setTop5(data.top5 || []);
          setScores(data.compatibility_scores || []);
        } catch {}
        setLoading(false);
      };
      load();
    }, [userId]);

    if (loading || top5.length === 0) return null;

    return (
      <div className="mx-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-5 h-5 text-love-gold" fill="currentColor" />
          <h3 className="text-sm font-bold">{t("fomo.weeklyTop5")}</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{t("fomo.refreshMonday")}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {top5.map((profile, i) => {
            const isLocked = !isPremium && i >= 2;
            return (
              <div key={profile.user_id} className="flex-shrink-0 w-[100px] relative">
                <div className={"aspect-[3/4] rounded-xl overflow-hidden relative " + (isLocked ? "opacity-60" : "")}>
                  <img src={profile.photos?.[0] || "/placeholder.jpg"} alt=""
                    className={"w-full h-full object-cover " + (isLocked ? "blur-sm" : "")} />
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Crown className="w-5 h-5 text-love-gold" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 bg-love-gold/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    #{i + 1}
                  </div>
                  {scores[i] && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {scores[i]}%
                    </div>
                  )}
                </div>
                <p className={"text-[10px] font-medium mt-1 truncate text-center " + (isLocked ? "blur-[3px]" : "")}>{profile.display_name}, {profile.age}</p>
              </div>
            );
          })}
          {!isPremium && (
            <button onClick={onUpgrade} className="flex-shrink-0 w-[100px] aspect-[3/4] rounded-xl border-2 border-dashed border-love-gold/30 flex flex-col items-center justify-center gap-1">
              <Crown className="w-6 h-6 text-love-gold" />
              <span className="text-[9px] text-love-gold font-medium">{t("fomo.seeAll5")}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // SOCIAL PROOF BADGES
  export function SocialProofBadges({ responseTime, ghostRate, matchRate, badges }: {
    responseTime?: number; ghostRate?: number; matchRate?: number; badges?: string[];
  }) {
    const { t } = useI18n();
    const items: { icon: typeof Clock; text: string; color: string }[] = [];

    if (responseTime && responseTime < 30) items.push({ icon: Clock, text: t("fomo.fastResponder", { min: responseTime }), color: "text-green-500" });
    else if (responseTime && responseTime < 120) items.push({ icon: Clock, text: t("fomo.respondsIn", { min: responseTime }), color: "text-blue-500" });

    if (ghostRate !== undefined && ghostRate < 5) items.push({ icon: Shield, text: t("fomo.neverGhosts"), color: "text-green-500" });
    if (matchRate && matchRate > 40) items.push({ icon: TrendingUp, text: t("fomo.popular", { pct: matchRate }), color: "text-love-pink" });

    if (items.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-0.5 bg-muted/50 rounded-full px-1.5 py-0.5">
            <item.icon className={"w-2.5 h-2.5 " + item.color} />
            <span className="text-[8px] font-medium text-foreground/70">{item.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // ICEBREAKER CARD
  export function IcebreakerCard({ question, myAnswer, theirAnswer, onAnswer }: {
    question: string; myAnswer?: string; theirAnswer?: string; onAnswer: (answer: string) => void;
  }) {
    const { t } = useI18n();
    const [answer, setAnswer] = useState("");

    if (myAnswer && theirAnswer) {
      return (
        <div className="bg-love-gold/5 border border-love-gold/20 rounded-2xl p-4 mb-3">
          <p className="text-xs font-medium text-love-gold mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />{t("fomo.icebreaker")}</p>
          <p className="text-sm font-medium mb-3">{question}</p>
          <div className="space-y-2">
            <div className="bg-muted/30 rounded-xl px-3 py-2"><p className="text-[10px] text-muted-foreground mb-0.5">{t("fomo.you")}</p><p className="text-sm">{myAnswer}</p></div>
            <div className="bg-love-pink/5 rounded-xl px-3 py-2"><p className="text-[10px] text-love-pink mb-0.5">{t("fomo.them")}</p><p className="text-sm">{theirAnswer}</p></div>
          </div>
        </div>
      );
    }

    if (myAnswer) {
      return (
        <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 mb-3">
          <p className="text-xs font-medium text-love-gold mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />{t("fomo.icebreaker")}</p>
          <p className="text-sm font-medium mb-2">{question}</p>
          <p className="text-xs text-muted-foreground">{t("fomo.waitingAnswer")}</p>
        </div>
      );
    }

    return (
      <div className="bg-love-gold/5 border border-love-gold/20 rounded-2xl p-4 mb-3">
        <p className="text-xs font-medium text-love-gold mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />{t("fomo.icebreaker")}</p>
        <p className="text-sm font-medium mb-3">{question}</p>
        <div className="flex gap-2">
          <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder={t("fomo.yourAnswer")} className="flex-1 bg-card border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-love-gold/50" />
          <Button size="sm" onClick={() => { if (answer.trim()) onAnswer(answer.trim()); }} disabled={!answer.trim()} className="rounded-xl bg-love-gold hover:bg-love-gold/90 text-white h-9">{t("chat.send")}</Button>
        </div>
      </div>
    );
  }
  