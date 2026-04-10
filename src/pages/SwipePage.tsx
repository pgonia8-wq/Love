import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Heart, X, Star, Undo2, MapPin, Sparkles, Shield, Crown, Flame, Lock } from "lucide-react";
import { useSwipes } from "@/hooks/useSwipes";
import { useI18n } from "@/lib/i18n";
import type { SwipeProfile } from "@/types";

const DAILY_FREE = 25;
const DAILY_PREMIUM = 50;
const EARLY_PRICE = 9.99;
const LATER_PRICE = 15.99;

function getDailySwipes(): { count: number; date: string } {
  try {
    const raw = localStorage.getItem("hlove_daily_swipes");
    if (raw) {
      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.date === today) return parsed;
    }
  } catch {}
  return { count: 0, date: new Date().toISOString().slice(0, 10) };
}

function incrementDailySwipes(): number {
  const current = getDailySwipes();
  const today = new Date().toISOString().slice(0, 10);
  const next = { count: current.date === today ? current.count + 1 : 1, date: today };
  localStorage.setItem("hlove_daily_swipes", JSON.stringify(next));
  return next.count;
}

interface SwipePageProps {
  userId: string;
  isPremium: boolean;
}

export default function SwipePage({ userId, isPremium }: SwipePageProps) {
  const { t } = useI18n();
  const { feed, isLoading, handleSwipe, handleUndo, canUndo, isProcessing } = useSwipes(userId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | "up" | null>(null);
  const [showMatch, setShowMatch] = useState<SwipeProfile | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [dailyCount, setDailyCount] = useState(getDailySwipes().count);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showEarlyBanner, setShowEarlyBanner] = useState(!isPremium);
  const [crushCount] = useState(Math.floor(Math.random() * 5) + 1);

  const dailyLimit = isPremium ? DAILY_PREMIUM : DAILY_FREE;
  const currentProfile = useMemo(() => feed[currentIndex], [feed, currentIndex]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const onSwipe = useCallback(
    async (action: "like" | "pass" | "superlike") => {
      if (!currentProfile || isProcessing) return;
      const newCount = incrementDailySwipes();
      setDailyCount(newCount);
      if (newCount > dailyLimit) { setShowLimitModal(true); return; }
      setExitDirection(action === "pass" ? "left" : action === "superlike" ? "up" : "right");
      try {
        const result = await handleSwipe(currentProfile.user_id, action);
        if (result?.matched) setShowMatch(currentProfile);
      } catch {}
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setExitDirection(null);
        setPhotoIndex(0);
      }, 400);
    },
    [currentProfile, handleSwipe, isProcessing, dailyLimit]
  );

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.x > 100) onSwipe("like");
      else if (info.offset.x < -100) onSwipe("pass");
      else if (info.offset.y < -100) onSwipe("superlike");
    },
    [onSwipe]
  );

  if (isLoading) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, border: "3px solid rgba(236,72,153,0.3)", borderTop: "3px solid #ec4899", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <Heart style={{ width: 40, height: 40, color: "#888", marginBottom: 16 }} />
        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#fff" }}>No more profiles</h3>
        <p style={{ color: "#888", fontSize: 14 }}>Check back later for new people in your area</p>
      </div>
    );
  }

  const exitVariant =
    exitDirection === "left" ? { x: -500, rotate: -20, opacity: 0, transition: { duration: 0.3 } }
    : exitDirection === "right" ? { x: 500, rotate: 20, opacity: 0, transition: { duration: 0.3 } }
    : exitDirection === "up" ? { y: -500, scale: 1.1, opacity: 0, transition: { duration: 0.3 } }
    : {};

  const TOPBAR_H = 36;
  const BANNER_H = showEarlyBanner && !isPremium ? 70 : 0;
  const BUTTONS_H = 72;
  const cardTop = TOPBAR_H + BANNER_H;
  const cardBottom = BUTTONS_H;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* Daily limit modal */}
      <AnimatePresence>
        {showLimitModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", padding: "0 32px" }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              style={{ background: "#1c1c1e", borderRadius: 24, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
              <Lock style={{ width: 40, height: 40, color: "#f59e0b", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{t("swipe.dailyLimitTitle")}</h3>
              <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>{t("swipe.dailyLimitDesc", { limit: dailyLimit })}</p>
              {!isPremium && (
                <button className="gradient-love" style={{ width: "100%", padding: "12px 0", borderRadius: 16, color: "#fff", fontWeight: 600, fontSize: 16, border: "none", marginBottom: 8 }}>
                  <Crown style={{ width: 16, height: 16, display: "inline", marginRight: 8 }} />{t("swipe.wantMore")}
                </button>
              )}
              <button onClick={() => setShowLimitModal(false)} style={{ color: "#888", fontSize: 14, background: "none", border: "none", padding: 8 }}>{t("common.close")}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match modal */}
      <AnimatePresence>
        {showMatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)", padding: "0 32px" }}>
            <Sparkles style={{ width: 48, height: 48, color: "#f59e0b", marginBottom: 16 }} />
            <h2 className="gradient-love-text" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>It's a Match!</h2>
            <p style={{ color: "#888", marginBottom: 24 }}>You and {showMatch.display_name} liked each other</p>
            <button onClick={() => setShowMatch(null)} className="gradient-love" style={{ color: "#fff", padding: "12px 32px", borderRadius: 16, fontWeight: 600, border: "none" }}>Keep Swiping</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR - absolute positioned */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: TOPBAR_H, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Flame style={{ width: 14, height: 14, color: "#ec4899" }} />
          <span style={{ fontSize: 12, color: "#888" }}>{dailyCount}/{dailyLimit}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Heart style={{ width: 12, height: 12, color: "#ec4899" }} fill="#ec4899" />
          <span style={{ fontSize: 12, color: "#ec4899", fontWeight: 600 }}>{crushCount} crushes</span>
        </div>
      </div>

      {/* EARLY ADOPTER BANNER - absolute positioned */}
      {showEarlyBanner && !isPremium && (
        <div style={{ position: "absolute", top: TOPBAR_H, left: 12, right: 12, height: BANNER_H - 6, zIndex: 10, padding: "8px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(236,72,153,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Crown style={{ width: 14, height: 14, color: "#f59e0b" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{t("fomo.limitedOffer")}</span>
            </div>
            <button onClick={() => setShowEarlyBanner(false)} style={{ color: "#888", fontSize: 16, background: "none", border: "none", lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#ccc" }}>${EARLY_PRICE}/mo</span>
            <span style={{ fontSize: 10, color: "#888", textDecoration: "line-through" }}>${LATER_PRICE}</span>
            <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 600, marginLeft: "auto" }}>{t("fomo.spotsLeft")}</span>
          </div>
          <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <motion.div animate={{ width: ["60%", "65%", "60%"] }} transition={{ repeat: Infinity, duration: 3 }}
              style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #ec4899, #f59e0b)" }} />
          </div>
        </div>
      )}

      {/* CARD AREA - absolute positioned, fills space between top and buttons */}
      <div style={{ position: "absolute", top: cardTop, left: 12, right: 12, bottom: cardBottom, zIndex: 1 }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentProfile.user_id}
            style={{ x, rotate, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: "hidden", touchAction: "none", cursor: "grab" }}
            drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} dragElastic={0.8}
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={exitVariant}
          >
            {/* Photo */}
            <img src={currentProfile.photos?.[photoIndex] || "/placeholder.jpg"} alt={currentProfile.display_name}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
              onClick={() => { if (currentProfile.photos && currentProfile.photos.length > 1) setPhotoIndex(p => p < currentProfile.photos.length - 1 ? p + 1 : 0); }} />

            {/* Photo indicators */}
            {currentProfile.photos && currentProfile.photos.length > 1 && (
              <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 3, zIndex: 5 }}>
                {currentProfile.photos.map((_: string, i: number) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === photoIndex ? "#fff" : "rgba(255,255,255,0.3)" }} />
                ))}
              </div>
            )}

            {/* LIKE / NOPE stamps */}
            <motion.div style={{ opacity: likeOpacity, position: "absolute", top: 40, left: 20, border: "4px solid #22c55e", borderRadius: 12, padding: "6px 14px", transform: "rotate(-15deg)", zIndex: 5 }}>
              <span style={{ color: "#22c55e", fontSize: 26, fontWeight: 900 }}>LIKE</span>
            </motion.div>
            <motion.div style={{ opacity: nopeOpacity, position: "absolute", top: 40, right: 20, border: "4px solid #ef4444", borderRadius: 12, padding: "6px 14px", transform: "rotate(15deg)", zIndex: 5 }}>
              <span style={{ color: "#ef4444", fontSize: 26, fontWeight: 900 }}>NOPE</span>
            </motion.div>

            {/* Bottom info overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)", padding: "60px 16px 16px", zIndex: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{currentProfile.display_name}</span>
                <span style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>{currentProfile.age}</span>
                <Shield style={{ width: 16, height: 16, color: "#ec4899", marginLeft: 2 }} />
              </div>
              {currentProfile.city && (
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <MapPin style={{ width: 12, height: 12 }} />{currentProfile.city}
                </p>
              )}
              {currentProfile.bio && (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4 }}>{currentProfile.bio}</p>
              )}
              {currentProfile.compatibility_score !== undefined && currentProfile.compatibility_score > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <Sparkles style={{ width: 12, height: 12, color: "#f59e0b" }} />
                  <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>{currentProfile.compatibility_score}% match</span>
                </div>
              )}
              {currentProfile.interests && currentProfile.interests.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {currentProfile.interests.slice(0, 4).map((interest: string) => (
                    <span key={interest} style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", padding: "2px 8px", borderRadius: 999 }}>{interest}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ACTION BUTTONS - absolute positioned at bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BUTTONS_H, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 10 }}>
        {isPremium && canUndo && (
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleUndo(isPremium)}
            style={{ width: 44, height: 44, borderRadius: "50%", background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Undo2 style={{ width: 18, height: 18, color: "#f59e0b" }} />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("pass")} disabled={isProcessing}
          style={{ width: 56, height: 56, borderRadius: "50%", background: "#1c1c1e", border: "2px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 28, height: 28, color: "#ef4444" }} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("superlike")} disabled={isProcessing}
          style={{ width: 44, height: 44, borderRadius: "50%", background: "#1c1c1e", border: "2px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Star style={{ width: 20, height: 20, color: "#f59e0b", fill: "#f59e0b" }} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("like")} disabled={isProcessing}
          className="gradient-love"
          style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", boxShadow: "0 0 20px rgba(236,72,153,0.4)" }}>
          <Heart style={{ width: 28, height: 28, color: "#fff", fill: "#fff" }} />
        </motion.button>
      </div>
    </div>
  );
}
