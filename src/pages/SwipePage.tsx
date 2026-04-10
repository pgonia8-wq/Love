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
          if (result?.matched) {
            setShowMatch(currentProfile);
          }
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
        const threshold = 100;
        if (info.offset.x > threshold) onSwipe("like");
        else if (info.offset.x < -threshold) onSwipe("pass");
        else if (info.offset.y < -threshold) onSwipe("superlike");
      },
      [onSwipe]
    );

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
        </div>
      );
    }

    if (!currentProfile) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No more profiles</h3>
          <p className="text-muted-foreground text-sm">
            Check back later for new people in your area
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Match modal */}
        <AnimatePresence>
          {showMatch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl px-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <Sparkles className="w-16 h-16 text-love-gold mx-auto mb-4" />
              </motion.div>
              <h2 className="text-3xl font-bold gradient-love-text mb-2">It's a Match!</h2>
              <p className="text-muted-foreground text-center mb-8">
                You and {showMatch.display_name} liked each other
              </p>
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-love-pink mb-8">
                <img src={showMatch.photos?.[0] || "/placeholder.jpg"} alt="" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => setShowMatch(null)}
                className="gradient-love text-white px-8 py-3 rounded-xl font-semibold"
              >
                Keep Swiping
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card area - takes all available space */}
        <div className="flex-1 relative min-h-0 p-3 pb-0">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentProfile.user_id}
              style={{ x, rotate }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={
                exitDirection === "left"
                  ? { x: -500, rotate: -20, opacity: 0, transition: { duration: 0.3 } }
                  : exitDirection === "right"
                    ? { x: 500, rotate: 20, opacity: 0, transition: { duration: 0.3 } }
                    : exitDirection === "up"
                      ? { y: -500, scale: 1.1, opacity: 0, transition: { duration: 0.3 } }
                      : {}
              }
              className="absolute inset-0 m-3 mb-0 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
            >
              <img
                src={currentProfile.photos?.[photoIndex] || "/placeholder.jpg"}
                alt={currentProfile.display_name}
                className="absolute inset-0 w-full h-full object-cover"
                onClick={() => {
                  if (currentProfile.photos && currentProfile.photos.length > 1) {
                    setPhotoIndex((prev) =>
                      prev < currentProfile.photos.length - 1 ? prev + 1 : 0
                    );
                  }
                }}
              />

              {/* Photo indicators */}
              {currentProfile.photos && currentProfile.photos.length > 1 && (
                <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
                  {currentProfile.photos.map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 flex-1 rounded-full ${
                        i === photoIndex ? "bg-white" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* LIKE overlay */}
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-8 left-6 border-4 border-green-500 rounded-xl px-4 py-2 rotate-[-15deg] z-10"
              >
                <span className="text-green-500 text-3xl font-black">LIKE</span>
              </motion.div>

              {/* NOPE overlay */}
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute top-8 right-6 border-4 border-red-500 rounded-xl px-4 py-2 rotate-[15deg] z-10"
              >
                <span className="text-red-500 text-3xl font-black">NOPE</span>
              </motion.div>

              {/* Profile info at bottom of card */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-20">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold text-white">
                    {currentProfile.display_name}
                  </h3>
                  <span className="text-xl text-white/80">{currentProfile.age}</span>
                  <Shield className="w-4 h-4 text-love-pink ml-1" />
                </div>
                {currentProfile.city && (
                  <p className="text-white/60 text-sm flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3" />
                    {currentProfile.city}
                  </p>
                )}
                {currentProfile.bio && (
                  <p className="text-white/70 text-sm line-clamp-2">{currentProfile.bio}</p>
                )}
                {currentProfile.compatibility_score !== undefined &&
                  currentProfile.compatibility_score > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-love-gold" />
                      <span className="text-love-gold text-xs font-medium">
                        {currentProfile.compatibility_score}% match
                      </span>
                    </div>
                  )}
                {currentProfile.interests && currentProfile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {currentProfile.interests.slice(0, 4).map((interest) => (
                      <span
                        key={interest}
                        className="text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action buttons - always visible at bottom */}
        <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 px-4">
          {isPremium && canUndo && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => handleUndo(isPremium)}
              className="w-11 h-11 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md"
            >
              <Undo2 className="w-5 h-5 text-love-gold" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onSwipe("pass")}
            disabled={isProcessing}
            className="w-14 h-14 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-lg"
          >
            <X className="w-7 h-7 text-destructive" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onSwipe("superlike")}
            disabled={isProcessing}
            className="w-11 h-11 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md"
          >
            <Star className="w-5 h-5 text-love-gold" fill="currentColor" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onSwipe("like")}
            disabled={isProcessing}
            className="w-14 h-14 rounded-full gradient-love flex items-center justify-center shadow-lg animate-pulse-glow"
          >
            <Heart className="w-7 h-7 text-white" fill="white" />
          </motion.button>
        </div>
      </div>
    );
  }
  