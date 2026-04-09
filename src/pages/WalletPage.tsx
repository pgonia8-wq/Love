import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Zap,
  Star,
  Eye,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePayments } from "@/hooks/usePayments";
import {
  PREMIUM_MONTHLY_PRICE,
  BOOST_PRICE,
  SUPERLIKE_PRICE,
  SEE_LIKES_PRICE,
} from "@/lib/constants";
import type { User } from "@/types";

interface WalletPageProps {
  user: User;
  userId: string;
}

const PREMIUM_FEATURES = [
  "Unlimited likes",
  "Undo last swipe",
  "See who liked you",
  "5 Super Likes per day",
  "1 free Boost per week",
  "Priority in swipe feed",
  "No ads ever",
];

type PurchaseType = "subscription" | "boost" | "superlike" | "see_likes";

export default function WalletPage({ user, userId }: WalletPageProps) {
  const { initiatePayment, getPrice } = usePayments(userId);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"WLD" | "USDC">("USDC");

  const handlePurchase = async (type: PurchaseType) => {
    setPurchasing(type);
    try {
      await initiatePayment(type, currency);
    } catch {}
    setPurchasing(null);
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-4 overflow-auto">
      <h2 className="text-2xl font-bold gradient-love-text mb-1">Premium</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Unlock the full H Love experience
      </p>

      <div className="flex gap-2 mb-6">
        {(["USDC", "WLD"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currency === c
                ? "gradient-love text-white shadow-md"
                : "bg-card text-foreground/70 border border-border/50"
            }`}
          >
            Pay with {c}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-5 mb-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 gradient-love opacity-10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-love flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">H Love Premium</h3>
              <p className="text-sm text-muted-foreground">Monthly subscription</p>
            </div>
          </div>

          <div className="space-y-2.5 mb-5">
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-love-pink shrink-0" />
                <span className="text-sm text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>

          {user.is_premium ? (
            <div className="flex items-center gap-2 p-3 bg-love-pink/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-love-pink" />
              <span className="text-sm font-medium text-love-pink">
                You're Premium!
                {user.premium_expires_at && (
                  <span className="text-xs text-love-pink/70 ml-1">
                    until {new Date(user.premium_expires_at).toLocaleDateString()}
                  </span>
                )}
              </span>
            </div>
          ) : (
            <Button
              onClick={() => handlePurchase("subscription")}
              disabled={purchasing === "subscription"}
              className="w-full h-12 gradient-love border-0 rounded-xl text-base font-semibold"
            >
              {purchasing === "subscription" ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  Subscribe for {PREMIUM_MONTHLY_PRICE} {currency}/mo
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>

      <h3 className="text-sm font-medium text-muted-foreground mb-3">One-time purchases</h3>
      <div className="space-y-3">
        {[
          {
            type: "boost" as PurchaseType,
            icon: Zap,
            title: "Profile Boost",
            desc: "Be seen by 10x more people for 30 minutes",
            price: BOOST_PRICE,
            color: "text-love-gold",
            bg: "bg-love-gold/10",
          },
          {
            type: "superlike" as PurchaseType,
            icon: Star,
            title: "Super Likes (x5)",
            desc: "Stand out from the crowd",
            price: SUPERLIKE_PRICE,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
          },
          {
            type: "see_likes" as PurchaseType,
            icon: Eye,
            title: "See Who Likes You",
            desc: "View all profiles that liked you",
            price: SEE_LIKES_PRICE,
            color: "text-love-purple",
            bg: "bg-love-purple/10",
          },
        ].map((item) => (
          <motion.div
            key={item.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold">{item.title}</h4>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePurchase(item.type)}
              disabled={purchasing === item.type}
              className="rounded-lg text-xs shrink-0"
            >
              {item.price} {currency}
            </Button>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 glass-card rounded-xl p-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          All payments are processed securely through World App using {currency}.
          A 15% platform fee applies to all transactions.
        </p>
      </div>
    </div>
  );
}
