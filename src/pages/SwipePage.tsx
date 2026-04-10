import { useState, useCallback, useMemo } from "react";
  import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
  import { Heart, X, Star, Undo2, MapPin, Sparkles, Shield, Lock, Zap, Crown } from "lucide-react";
  import { useSwipes } from "@/hooks/useSwipes";
  import { Button } from "@/components/ui/button";
  import type { SwipeProfile } from "@/types";

  interface SwipePageProps {
    userId: string;
    isPremium: boolean;
    onUpgrade?: () => void;
  }

  const PREMIUM_PREFIXES = ["0xmock_f_000","0xmock_f_001","0xmock_f_002","0xmock_f_003","0xmock_f_004","0xmock_f_005","0xmock_f_006","0xmock_f_007","0xmock_f_008","0xmock_f_009","0xmock_f_010","0xmock_f_011","0xmock_f_012","0xmock_f_013","0xmock_f_014","0xmock_f_015","0xmock_f_016","0xmock_f_017","0xmock_f_018","0xmock_f_019","0xmock_f_020","0xmock_f_021","0xmock_f_022","0xmock_f_023","0xmock_f_024","0xmock_f_025","0xmock_f_026","0xmock_f_027","0xmock_f_028","0xmock_f_029","0xmock_m_000","0xmock_m_001","0xmock_m_002","0xmock_m_003","0xmock_m_004"];

  function isPremiumProfile(userId: string) {
    return PREMIUM_PREFIXES.some(p => userId.startsWith(p));
  }

  export default function SwipePage({ userId, isPremium, onUpgrade }: SwipePageProps) {
    const { feed, isLoading, handleSwipe, handleUndo, canUndo, isProcessing } = useSwipes(userId);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [exitDirection, setExitDirection] = useState<"left" | "right" | "up" | null>(null);
    const [showMatch, setShowMatch] = useState<SwipeProfile | null>(null);
    const [showPremiumGate, setShowPremiumGate] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [likesCount] = useState(Math.floor(Math.random() * 12) + 5);

    const currentProfile = useMemo(() => feed[currentIndex], [feed, currentIndex]);
    const isCurrentPremiumLocked = currentProfile && !isPremium && isPremiumProfile(currentProfile.user_id);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 300], [-15, 15]);
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const onSwipe = useCallback(async (action: "like" | "pass" | "superlike") => {
      if (!currentProfile || isProcessing) return;

      if (isCurrentPremiumLocked && action !== "pass") {
        setShowPremiumGate(true);
        return;
      }

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
    }, [currentProfile, handleSwipe, isProcessing, isCurrentPremiumLocked]);

    const handleDragEnd = useCallback((_: any, info: PanInfo) => {
      if (isCurrentPremiumLocked) {
        if (info.offset.x > 100 || info.offset.y < -100) { setShowPremiumGate(true); return; }
      }
      if (info.offset.x > 100) onSwipe("like");
      else if (info.offset.x < -100) onSwipe("pass");
      else if (info.offset.y < -100) onSwipe("superlike");
    }, [onSwipe, isCurrentPremiumLocked]);

    if (isLoading) {
      return (<div className="flex-1 flex items-center justify-center"><div className="w-12 h-12 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" /></div>);
    }

    if (!currentProfile) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5"><Heart className="w-10 h-10 text-muted-foreground" /></div>
          <h3 className="text-xl font-semibold mb-2">No more profiles</h3>
          <p className="text-muted-foreground text-sm">Check back later for new people in your area</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Likes counter - FOMO */}
        {!isPremium && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 left-4 z-40">
            <button onClick={() => setShowPremiumGate(true)} className="flex items-center gap-2 bg-love-gold/10 border border-love-gold/30 rounded-full px-3 py-1.5">
              <Heart className="w-4 h-4 text-love-gold" fill="currentColor" />
              <span className="text-xs font-semibold text-love-gold">{likesCount} likes</span>
              <Lock className="w-3 h-3 text-love-gold/60" />
            </button>
          </motion.div>
        )}

        {/* Premium gate overlay */}
        <AnimatePresence>
          {showPremiumGate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl px-6" onClick={() => setShowPremiumGate(false)}>
              <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8 }} onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-border/50">
                <div className="w-16 h-16 rounded-2xl gradient-love flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-center mb-2">Unlock Premium</h3>
                <p className="text-sm text-muted-foreground text-center mb-5">Get unlimited likes, see who likes you, boost your profile, and connect with exclusive members</p>
                <div className="space-y-2 mb-5">
                  {[
                    { icon: Heart, text: "Unlimited likes & super likes", color: "text-love-pink" },
                    { icon: Sparkles, text: "See who already liked you", color: "text-love-gold" },
                    { icon: Zap, text: "1 free boost per week", color: "text-love-purple" },
                    { icon: Shield, text: "Priority in the feed", color: "text-green-500" },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-xl">
                      <f.icon className={"w-4 h-4 " + f.color} />
                      <span className="text-sm">{f.text}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Button className="w-full h-12 gradient-love border-0 rounded-xl font-semibold text-base" onClick={() => { setShowPremiumGate(false); if (onUpgrade) onUpgrade(); }}>
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade — 9.99 USDC/mo
                  </Button>
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setShowPremiumGate(false)}>
                    Maybe later
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Match animation */}
        <AnimatePresence>
          {showMatch && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl px-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                <Sparkles className="w-16 h-16 text-love-gold mx-auto mb-4" />
              </motion.div>
              <h2 className="text-3xl font-bold gradient-love-text mb-2">It's a Match!</h2>
              <p className="text-muted-foreground text-center mb-8">You and {showMatch.display_name} liked each other</p>
              <div className="flex gap-4 mb-8">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-love-pink">
                  <img src={showMatch.photos?.[0] || "/placeholder.jpg"} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
              <button onClick={() => setShowMatch(null)} className="gradient-love text-white px-8 py-3 rounded-xl font-semibold">Keep Swiping</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentProfile.user_id}
              style={{ x, rotate }}
              drag={!isCurrentPremiumLocked || true}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={exitDirection === "left" ? { x: -500, rotate: -20, opacity: 0, transition: { duration: 0.3 } } : exitDirection === "right" ? { x: 500, rotate: 20, opacity: 0, transition: { duration: 0.3 } } : exitDirection === "up" ? { y: -500, scale: 1.1, opacity: 0, transition: { duration: 0.3 } } : {}}
              className="absolute w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
            >
              <div className="relative w-full h-full">
                <img
                  src={currentProfile.photos?.[photoIndex] || "/placeholder.jpg"}
                  alt={currentProfile.display_name}
                  className={"w-full h-full object-cover " + (isCurrentPremiumLocked ? "blur-[6px]" : "")}
                  onClick={() => {
                    if (!isCurrentPremiumLocked && currentProfile.photos && currentProfile.photos.length > 1) {
                      setPhotoIndex((prev) => prev < currentProfile.photos.length - 1 ? prev + 1 : 0);
                    }
                  }}
                />

                {/* Premium lock overlay */}
                {isCurrentPremiumLocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={() => setShowPremiumGate(true)}>
                    <div className="w-14 h-14 rounded-full bg-love-gold/20 border border-love-gold/40 flex items-center justify-center mb-3">
                      <Crown className="w-7 h-7 text-love-gold" />
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">Premium Profile</p>
                    <p className="text-white/70 text-xs">Upgrade to connect</p>
                  </div>
                )}

                {currentProfile.photos && currentProfile.photos.length > 1 && !isCurrentPremiumLocked && (
                  <div className="absolute top-3 left-3 right-3 flex gap-1">
                    {currentProfile.photos.map((_, i) => (<div key={i} className={"h-0.5 flex-1 rounded-full " + (i === photoIndex ? "bg-white" : "bg-white/30")} />))}
                  </div>
                )}

                {!isCurrentPremiumLocked && (
                  <>
                    <motion.div style={{ opacity: likeOpacity }} className="absolute top-8 left-6 border-4 border-green-500 rounded-xl px-4 py-2 rotate-[-15deg]"><span className="text-green-500 text-3xl font-black">LIKE</span></motion.div>
                    <motion.div style={{ opacity: nopeOpacity }} className="absolute top-8 right-6 border-4 border-red-500 rounded-xl px-4 py-2 rotate-[15deg]"><span className="text-red-500 text-3xl font-black">NOPE</span></motion.div>
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-20">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold text-white">{isCurrentPremiumLocked ? currentProfile.display_name.charAt(0) + "***" : currentProfile.display_name}</h3>
                    <span className="text-xl text-white/80">{currentProfile.age}</span>
                    <Shield className="w-4 h-4 text-love-pink ml-1" />
                    {isCurrentPremiumLocked && <Crown className="w-4 h-4 text-love-gold" />}
                  </div>
                  {currentProfile.city && <p className="text-white/60 text-sm flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{currentProfile.city}</p>}
                  {!isCurrentPremiumLocked && currentProfile.bio && <p className="text-white/70 text-sm line-clamp-2">{currentProfile.bio}</p>}
                  {currentProfile.compatibility_score !== undefined && currentProfile.compatibility_score > 0 && (
                    <div className="mt-2 flex items-center gap-1"><Sparkles className="w-3 h-3 text-love-gold" /><span className="text-love-gold text-xs font-medium">{currentProfile.compatibility_score}% match</span></div>
                  )}
                  {!isCurrentPremiumLocked && currentProfile.interests && currentProfile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {currentProfile.interests.slice(0, 4).map((interest) => (<span key={interest} className="text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full">{interest}</span>))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-5 py-5 px-4">
          {isPremium && canUndo && (
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleUndo(isPremium)} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md">
              <Undo2 className="w-5 h-5 text-love-gold" />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("pass")} disabled={isProcessing} className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-lg">
            <X className="w-8 h-8 text-destructive" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("superlike")} disabled={isProcessing} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md">
            <Star className="w-6 h-6 text-love-gold" fill="currentColor" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => onSwipe("like")} disabled={isProcessing} className="w-16 h-16 rounded-full gradient-love flex items-center justify-center shadow-lg animate-pulse-glow">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </motion.button>
          {!isPremium && (
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowPremiumGate(true)} className="w-12 h-12 rounded-full bg-love-gold/10 border border-love-gold/30 flex items-center justify-center shadow-md">
              <Zap className="w-5 h-5 text-love-gold" />
            </motion.button>
          )}
        </div>
      </div>
    );
  }
  