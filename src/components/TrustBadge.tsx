import { Shield, Heart, Users, Star } from "lucide-react";
  import { useI18n } from "@/lib/i18n";

  interface TrustBadgeProps {
    trustScore?: number;
    verifiedDates?: number;
    vouchCount?: number;
    compact?: boolean;
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-love-gold";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  }

  function getScoreLabel(score: number, t: (k: string) => string): string {
    if (score >= 80) return t("trust.excellent");
    if (score >= 60) return t("trust.good");
    if (score >= 40) return t("trust.average");
    return t("trust.new");
  }

  export function TrustScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" | "lg" }) {
    const color = getScoreColor(score);
    const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-10 h-10 text-xs", lg: "w-14 h-14 text-sm" };
    return (
      <div className={"rounded-full border-2 flex items-center justify-center font-bold " + sizes[size] + " " + color + " border-current"}>
        {score}
      </div>
    );
  }

  export function TrustBadgeInline({ trustScore = 50, verifiedDates = 0, vouchCount = 0, compact = true }: TrustBadgeProps) {
    const { t } = useI18n();

    if (compact) {
      return (
        <div className="flex items-center gap-1.5">
          {trustScore > 0 && (
            <div className={"flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold " + (trustScore >= 70 ? "bg-green-500/10 text-green-500" : trustScore >= 50 ? "bg-love-gold/10 text-love-gold" : "bg-muted text-muted-foreground")}>
              <Shield className="w-2.5 h-2.5" />{trustScore}
            </div>
          )}
          {verifiedDates > 0 && (
            <div className="flex items-center gap-0.5 bg-love-pink/10 text-love-pink rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              <Heart className="w-2.5 h-2.5" />{verifiedDates}
            </div>
          )}
          {vouchCount > 0 && (
            <div className="flex items-center gap-0.5 bg-blue-500/10 text-blue-500 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              <Users className="w-2.5 h-2.5" />{vouchCount}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <TrustScoreBadge score={trustScore} size="md" />
          <span className="text-[9px] text-muted-foreground mt-0.5">{t("trust.score")}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-love-pink/10 flex items-center justify-center">
            <span className="text-sm font-bold text-love-pink">{verifiedDates}</span>
          </div>
          <span className="text-[9px] text-muted-foreground mt-0.5">{t("trust.dates")}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <span className="text-sm font-bold text-blue-500">{vouchCount}</span>
          </div>
          <span className="text-[9px] text-muted-foreground mt-0.5">{t("trust.vouches")}</span>
        </div>
      </div>
    );
  }

  export function ProofOfDateBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
      <div className="flex items-center gap-1 bg-love-pink/10 border border-love-pink/20 rounded-full px-2 py-0.5">
        <Heart className="w-3 h-3 text-love-pink" fill="currentColor" />
        <span className="text-[10px] font-semibold text-love-pink">{count} verified date{count !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  export function VouchedByBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
      <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
        <Users className="w-3 h-3 text-blue-500" />
        <span className="text-[10px] font-semibold text-blue-500">Vouched by {count}</span>
      </div>
    );
  }
  