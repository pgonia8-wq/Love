import { useState, useCallback, useMemo } from "react";
  import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
  import { Heart, X, Star, Undo2, MapPin, Sparkles, Shield, Lock, Zap, Crown } from "lucide-react";
  import { useSwipes } from "@/hooks/useSwipes";
  import { useI18n } from "@/lib/i18n";
  import { Button } from "@/components/ui/button";
  import type { SwipeProfile } from "@/types";

  interface SwipePageProps {
    userId: string;
    isPremium: boolean;
    onUpgrade?: () => void;
  }

  const PREMIUM_IDS = Array.from({ length: 30 }, (_, i) => "0xmock_f_" + String(i).padStart(3, "0"))
    .concat(Array.from({ length: 5 }, (_, i) => "0xmock_m_" + String(i).padStart(3, "0")));

  function isPremiumProfile(uid: string) {
    return PREMIUM_IDS.some(p => uid.startsWith(p));
  }

  export default function SwipePage({ userId, isPremium, onUpgrade }: SwipePageProps) {
    const { t } = useI18n();
    const { feed, isLoading, handleSwipe, handleUndo, canUndo, isProcessing } = useSwipes(userId);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [exitDir, setExitDir] = useState<"left"|"right"|"up"|null>(null);
    const [showMatch, setShowMatch] = useState<SwipeProfile|null>(null);
    const [showGate, setShowGate] = useState(false);
    const [photoIdx, setPhotoIdx] = useState(0);
    const [likesCount] = useState(Math.floor(Math.random()*12)+5);

    const cur = useMemo(() => feed[currentIndex], [feed, currentIndex]);
    const locked = cur && !isPremium && isPremiumProfile(cur.user_id);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 300], [-15, 15]);
    const likeOp = useTransform(x, [0, 100], [0, 1]);
    const nopeOp = useTransform(x, [-100, 0], [1, 0]);

    const doSwipe = useCallback(async (action: "like"|"pass"|"superlike") => {
      if (!cur || isProcessing) return;
      if (locked && action !== "pass") { setShowGate(true); return; }

      setExitDir(action === "pass" ? "left" : action === "superlike" ? "up" : "right");
      try {
        const res = await handleSwipe(cur.user_id, action);
        if (res?.matched) setShowMatch(cur);
      } catch {}
      setTimeout(() => { setCurrentIndex(p => p+1); setExitDir(null); setPhotoIdx(0); }, 400);
    }, [cur, handleSwipe, isProcessing, locked]);

    const onDragEnd = useCallback((_: any, info: PanInfo) => {
      if (locked && (info.offset.x > 100 || info.offset.y < -100)) { setShowGate(true); return; }
      if (info.offset.x > 100) doSwipe("like");
      else if (info.offset.x < -100) doSwipe("pass");
      else if (info.offset.y < -100) doSwipe("superlike");
    }, [doSwipe, locked]);

    if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="w-12 h-12 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" /></div>;

    if (!cur) return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5"><Heart className="w-10 h-10 text-muted-foreground" /></div>
        <h3 className="text-xl font-semibold mb-2">{t("swipe.noMore")}</h3>
        <p className="text-muted-foreground text-sm">{t("swipe.noMoreSub")}</p>
      </div>
    );

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!isPremium && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} className="absolute top-3 left-4 z-40">
            <button onClick={() => setShowGate(true)} className="flex items-center gap-2 bg-love-gold/10 border border-love-gold/30 rounded-full px-3 py-1.5">
              <Heart className="w-4 h-4 text-love-gold" fill="currentColor" />
              <span className="text-xs font-semibold text-love-gold">{likesCount} {t("swipe.likes")}</span>
              <Lock className="w-3 h-3 text-love-gold/60" />
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {showGate && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl px-6" onClick={() => setShowGate(false)}>
              <motion.div initial={{scale:0.8,y:30}} animate={{scale:1,y:0}} exit={{scale:0.8}} onClick={e => e.stopPropagation()} className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-border/50">
                <div className="w-16 h-16 rounded-2xl gradient-love flex items-center justify-center mx-auto mb-4"><Crown className="w-8 h-8 text-white" /></div>
                <h3 className="text-xl font-bold text-center mb-2">{t("premium.unlock")}</h3>
                <p className="text-sm text-muted-foreground text-center mb-5">{t("premium.description")}</p>
                <div className="space-y-2 mb-5">
                  {[
                    { icon: Heart, text: t("premium.unlimitedLikes"), color: "text-love-pink" },
                    { icon: Sparkles, text: t("premium.seeWhoLiked"), color: "text-love-gold" },
                    { icon: Zap, text: t("premium.freeBoost"), color: "text-love-purple" },
                    { icon: Shield, text: t("premium.priorityFeed"), color: "text-green-500" },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-xl">
                      <f.icon className={"w-4 h-4 "+f.color} /><span className="text-sm">{f.text}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Button className="w-full h-12 gradient-love border-0 rounded-xl font-semibold text-base" onClick={() => { setShowGate(false); onUpgrade?.(); }}>
                    <Crown className="w-4 h-4 mr-2" />{t("premium.upgrade")}
                  </Button>
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setShowGate(false)}>{t("premium.maybeLater")}</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMatch && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl px-8">
              <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",delay:0.2}}><Sparkles className="w-16 h-16 text-love-gold mx-auto mb-4" /></motion.div>
              <h2 className="text-3xl font-bold gradient-love-text mb-2">{t("swipe.itsAMatch")}</h2>
              <p className="text-muted-foreground text-center mb-8">{t("swipe.youAndLiked", { name: showMatch.display_name })}</p>
              <div className="flex gap-4 mb-8">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-love-pink"><img src={showMatch.photos?.[0]} alt="" className="w-full h-full object-cover" /></div>
              </div>
              <button onClick={() => setShowMatch(null)} className="gradient-love text-white px-8 py-3 rounded-xl font-semibold">{t("swipe.keepSwiping")}</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative flex items-center justify-center p-4">
          <AnimatePresence mode="popLayout">
            <motion.div key={cur.user_id} style={{x,rotate}} drag dragConstraints={{left:0,right:0,top:0,bottom:0}} dragElastic={0.8} onDragEnd={onDragEnd}
              initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
              exit={exitDir==="left"?{x:-500,rotate:-20,opacity:0,transition:{duration:0.3}}:exitDir==="right"?{x:500,rotate:20,opacity:0,transition:{duration:0.3}}:exitDir==="up"?{y:-500,scale:1.1,opacity:0,transition:{duration:0.3}}:{}}
              className="absolute w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing">
              <div className="relative w-full h-full">
                <img src={cur.photos?.[photoIdx] || "/placeholder.jpg"} alt={cur.display_name} className={"w-full h-full object-cover "+(locked?"blur-[6px]":"")}
                  onClick={() => { if (!locked && cur.photos?.length > 1) setPhotoIdx(p => p < cur.photos.length-1 ? p+1 : 0); }} />

                {locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={() => setShowGate(true)}>
                    <div className="w-14 h-14 rounded-full bg-love-gold/20 border border-love-gold/40 flex items-center justify-center mb-3"><Crown className="w-7 h-7 text-love-gold" /></div>
                    <p className="text-white font-semibold text-sm mb-1">{t("swipe.premiumProfile")}</p>
                    <p className="text-white/70 text-xs">{t("swipe.upgradeToConnect")}</p>
                  </div>
                )}

                {cur.photos?.length > 1 && !locked && (
                  <div className="absolute top-3 left-3 right-3 flex gap-1">
                    {cur.photos.map((_: any, i: number) => <div key={i} className={"h-0.5 flex-1 rounded-full "+(i===photoIdx?"bg-white":"bg-white/30")} />)}
                  </div>
                )}

                {!locked && (<>
                  <motion.div style={{opacity:likeOp}} className="absolute top-8 left-6 border-4 border-green-500 rounded-xl px-4 py-2 rotate-[-15deg]"><span className="text-green-500 text-3xl font-black">LIKE</span></motion.div>
                  <motion.div style={{opacity:nopeOp}} className="absolute top-8 right-6 border-4 border-red-500 rounded-xl px-4 py-2 rotate-[15deg]"><span className="text-red-500 text-3xl font-black">NOPE</span></motion.div>
                </>)}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-20">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold text-white">{locked ? cur.display_name.charAt(0)+"***" : cur.display_name}</h3>
                    <span className="text-xl text-white/80">{cur.age}</span>
                    <Shield className="w-4 h-4 text-love-pink ml-1" />
                    {locked && <Crown className="w-4 h-4 text-love-gold" />}
                  </div>
                  {cur.city && <p className="text-white/60 text-sm flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{cur.city}</p>}
                  {!locked && cur.bio && <p className="text-white/70 text-sm line-clamp-2">{cur.bio}</p>}
                  {!locked && cur.interests?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cur.interests.slice(0,4).map((interest: string) => <span key={interest} className="text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full">{interest}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-5 py-5 px-4">
          {isPremium && canUndo && (
            <motion.button whileTap={{scale:0.85}} onClick={() => handleUndo(isPremium)} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md"><Undo2 className="w-5 h-5 text-love-gold" /></motion.button>
          )}
          <motion.button whileTap={{scale:0.85}} onClick={() => doSwipe("pass")} disabled={isProcessing} className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-lg"><X className="w-8 h-8 text-destructive" /></motion.button>
          <motion.button whileTap={{scale:0.85}} onClick={() => doSwipe("superlike")} disabled={isProcessing} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-md"><Star className="w-6 h-6 text-love-gold" fill="currentColor" /></motion.button>
          <motion.button whileTap={{scale:0.85}} onClick={() => doSwipe("like")} disabled={isProcessing} className="w-16 h-16 rounded-full gradient-love flex items-center justify-center shadow-lg animate-pulse-glow"><Heart className="w-8 h-8 text-white" fill="white" /></motion.button>
          {!isPremium && (
            <motion.button whileTap={{scale:0.85}} onClick={() => setShowGate(true)} className="w-12 h-12 rounded-full bg-love-gold/10 border border-love-gold/30 flex items-center justify-center shadow-md"><Zap className="w-5 h-5 text-love-gold" /></motion.button>
          )}
        </div>
      </div>
    );
  }
  