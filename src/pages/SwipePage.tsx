import { useState, useCallback, useMemo } from "react";
  import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
  import { Heart, X, Star, Undo2, MapPin, Sparkles, Shield } from "lucide-react";
  import { useSwipes } from "@/hooks/useSwipes";
  import type { SwipeProfile } from "@/types";

  interface SwipePageProps {
    userId: string;
    isPremium: boolean;
  }

  export default function SwipePage({ userId, isPremium }: SwipePageProps) {
    const { feed, isLoading, handleSwipe, handleUndo, canUndo, isProcessing } =
      useSwipes(userId);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [exitDirection, setExitDirection] = useState<"left" | "right" | "up" | null>(null);
    const [showMatch, setShowMatch] = useState<SwipeProfile | null>(null);
    const [photoIndex, setPhotoIndex] = useState(0);

    const currentProfile = useMemo(() => feed[currentIndex], [feed, currentIndex]);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 300], [-15, 15]);
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const onSwipe = useCallback(
      async (action: "like" | "pass" | "superlike") => {
        if (!currentProfile || isProcessing) return;
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
      [currentProfile, handleSwipe, isProcessing]
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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="w-12 h-12 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
        </div>
      );
    }

    if (!currentProfile) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 2rem" }}>
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No more profiles</h3>
          <p className="text-muted-foreground text-sm text-center">Check back later for new people in your area</p>
        </div>
      );
    }

    const exitVariant =
      exitDirection === "left"
        ? { x: -500, rotate: -20, opacity: 0, transition: { duration: 0.3 } }
        : exitDirection === "right"
          ? { x: 500, rotate: 20, opacity: 0, transition: { duration: 0.3 } }
          : exitDirection === "up"
            ? { y: -500, scale: 1.1, opacity: 0, transition: { duration: 0.3 } }
            : {};

    return (
      <>
        {/* Match overlay */}
        <AnimatePresence>
          {showMatch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)", padding: "0 2rem" }}
            >
              <Sparkles className="w-16 h-16 text-love-gold mb-4" />
              <h2 className="text-3xl font-bold gradient-love-text mb-2">It's a Match!</h2>
              <p className="text-muted-foreground text-center mb-8">You and {showMatch.display_name} liked each other</p>
              <button onClick={() => setShowMatch(null)} className="gradient-love text-white px-8 py-3 rounded-xl font-semibold">Keep Swiping</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main layout: card + buttons, using inline styles for guaranteed rendering */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Card container */}
          <div style={{ flex: 1, position: "relative", minHeight: 0, margin: "8px 12px 0 12px" }}>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentProfile.user_id}
                style={{ x, rotate, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: "hidden", touchAction: "none" }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.8}
                onDragEnd={handleDragEnd}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={exitVariant}
              >
                {/* Photo - fills entire card */}
                <img
                  src={currentProfile.photos?.[photoIndex] || "/placeholder.jpg"}
                  alt={currentProfile.display_name}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onClick={() => {
                    if (currentProfile.photos && currentProfile.photos.length > 1) {
                      setPhotoIndex((prev) => prev < currentProfile.photos.length - 1 ? prev + 1 : 0);
                    }
                  }}
                />

                {/* Photo dots */}
                {currentProfile.photos && currentProfile.photos.length > 1 && (
                  <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 4, zIndex: 5 }}>
                    {currentProfile.photos.map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === photoIndex ? "#fff" : "rgba(255,255,255,0.3)" }} />
                    ))}
                  </div>
                )}

                {/* LIKE label */}
                <motion.div style={{ opacity: likeOpacity, position: "absolute", top: 40, left: 24, border: "4px solid #22c55e", borderRadius: 12, padding: "8px 16px", transform: "rotate(-15deg)", zIndex: 5 }}>
                  <span style={{ color: "#22c55e", fontSize: 28, fontWeight: 900 }}>LIKE</span>
                </motion.div>

                {/* NOPE label */}
                <motion.div style={{ opacity: nopeOpacity, position: "absolute", top: 40, right: 24, border: "4px solid #ef4444", borderRadius: 12, padding: "8px 16px", transform: "rotate(15deg)", zIndex: 5 }}>
                  <span style={{ color: "#ef4444", fontSize: 28, fontWeight: 900 }}>NOPE</span>
                </motion.div>

                {/* Bottom gradient with profile info */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)", padding: "80px 16px 16px 16px", zIndex: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{currentProfile.display_name}</span>
                    <span style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>{currentProfile.age}</span>
                    <Shield style={{ width: 16, height: 16, color: "#ec4899", marginLeft: 4 }} />
                  </div>
                  {currentProfile.city && (
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <MapPin style={{ width: 12, height: 12 }} />
                      {currentProfile.city}
                    </p>
                  )}
                  {currentProfile.bio && (
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{currentProfile.bio}</p>
                  )}
                  {currentProfile.interests && currentProfile.interests.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {currentProfile.interests.slice(0, 4).map((interest) => (
                        <span key={interest} style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", padding: "2px 8px", borderRadius: 999 }}>{interest}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action buttons - fixed height, always visible */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 16px", height: 72 }}>
            {isPremium && canUndo && (
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleUndo(isPremium)}
                style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--card)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Undo2 style={{ width: 20, height: 20, color: "#f59e0b" }} />
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("pass")} disabled={isProcessing}
              style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--card)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X style={{ width: 28, height: 28, color: "#ef4444" }} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("superlike")} disabled={isProcessing}
              style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--card)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star style={{ width: 20, height: 20, color: "#f59e0b", fill: "#f59e0b" }} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("like")} disabled={isProcessing}
              className="gradient-love animate-pulse-glow"
              style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart style={{ width: 28, height: 28, color: "#fff", fill: "#fff" }} />
            </motion.button>
          </div>
        </div>
      </>
    );
  }
  