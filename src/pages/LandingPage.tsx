import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Heart, Sparkles, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingPageProps {
  onVerify: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export default function LandingPage({ onVerify, isLoading, error }: LandingPageProps) {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    await onVerify();
    setVerifying(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-love-pink/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-love-purple/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-love-gold/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-md w-full"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-3xl gradient-love flex items-center justify-center mb-8 shadow-xl animate-pulse-glow"
        >
          <Heart className="w-12 h-12 text-white" fill="white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-5xl font-bold gradient-love-text mb-3 tracking-tight"
        >
          H Love
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground text-lg text-center mb-10 leading-relaxed"
        >
          Real humans. Real connections.
          <br />
          <span className="text-foreground/80">Verified by World ID.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full space-y-4 mb-10"
        >
          {[
            { icon: Shield, text: "100% Orb-verified humans only", color: "text-love-pink" },
            { icon: Sparkles, text: "Premium connections, zero bots", color: "text-love-purple" },
            { icon: Users, text: "Exclusive events & meetups", color: "text-love-gold" },
            { icon: CheckCircle, text: "Safe, respectful community", color: "text-love-rose" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="flex items-center gap-4 glass-card rounded-xl px-5 py-3.5"
            >
              <item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
              <span className="text-sm text-foreground/90">{item.text}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="w-full"
        >
          <Button
            onClick={handleVerify}
            disabled={isLoading || verifying}
            className="w-full h-14 text-lg font-semibold gradient-love border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            {verifying || isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                Verify with World ID
              </>
            )}
          </Button>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-destructive text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mt-6 text-xs text-muted-foreground text-center"
        >
          Requires World App with Orb verification
        </motion.p>
      </motion.div>
    </div>
  );
}
