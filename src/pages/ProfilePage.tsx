import { useState } from "react";
  import { motion } from "framer-motion";
  import { Shield, Crown, Zap, Edit2, LogOut, Camera, Heart, Star, TrendingUp, Share2, Check, Copy } from "lucide-react";
  import { useI18n } from "@/lib/i18n";
  import { Button } from "@/components/ui/button";
  import type { Profile, User as UserType } from "@/types";

  interface ProfilePageProps {
    user: UserType;
    profile: Profile;
    onUpdate: (updates: Partial<Profile>) => Promise<any>;
    onLogout: () => void;
    onUpgrade: () => void;
  }

  export default function ProfilePage({ user, profile, onUpdate, onLogout, onUpgrade }: ProfilePageProps) {
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(profile.display_name || "");
    const [editBio, setEditBio] = useState(profile.bio || "");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const isPremium = user?.is_premium || false;
    const stats = [
      { label: t("profile.matches"), value: "—", icon: Heart },
      { label: t("profile.superLikes"), value: "—", icon: Star },
      { label: t("profile.matchRate"), value: "—", icon: TrendingUp },
    ];

    const handleSave = async () => {
      setSaving(true);
      await onUpdate({ display_name: editName, bio: editBio });
      setSaving(false);
      setEditing(false);
    };

    const copyReferral = () => {
      const code = user?.referral_code || "HLOVE";
      navigator.clipboard.writeText("https://h-love-clean.vercel.app?ref=" + code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-6 pt-2">
          <h2 className="text-2xl font-bold">{t("profile.editProfile")}</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Edit2 className="w-4 h-4" /></button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-love border-0 rounded-xl h-9 px-4 text-xs font-medium">
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
          )}
        </div>

        {/* Profile card */}
        <div className="bg-card rounded-3xl border border-border/30 overflow-hidden mb-5 shadow-sm">
          <div className="relative h-48">
            <img src={profile.photos?.[0] || "/placeholder.jpg"} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">{profile.display_name}</h3>
                <span className="text-lg text-white/70">{profile.age}</span>
                <Shield className="w-4 h-4 text-love-pink" />
                {isPremium && <Crown className="w-4 h-4 text-love-gold" />}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] text-white/60">{t("profile.orbVerified")}</span>
              </div>
            </div>
            <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>

          {editing ? (
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("profile.name")}</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-love-pink/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("profile.bio")}</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-love-pink/50 min-h-[80px] resize-none" />
              </div>
            </div>
          ) : (
            <div className="p-4">
              {profile.bio && <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>}
              {profile.interests && profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((interest) => (<span key={interest} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{interest}</span>))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {stats.map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/30 p-3 text-center">
              <stat.icon className="w-4 h-4 text-love-pink mx-auto mb-1" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Photos grid */}
        {profile.photos && profile.photos.length > 1 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-2">{t("profile.photos")}</h4>
            <div className="grid grid-cols-3 gap-2">
              {profile.photos.map((photo, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute top-1 left-1 text-[8px] bg-love-pink/80 text-white px-1.5 py-0.5 rounded-full">Main</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Premium section */}
        <div className={`rounded-2xl border p-4 mb-4 ${isPremium ? "bg-love-gold/5 border-love-gold/20" : "bg-muted/30 border-border/30"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className={`w-5 h-5 ${isPremium ? "text-love-gold" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-semibold">{t("profile.premium")}</p>
                <p className="text-[10px] text-muted-foreground">{isPremium ? t("profile.premiumMember") : t("profile.getPremium")}</p>
              </div>
            </div>
            {!isPremium && (
              <Button size="sm" onClick={onUpgrade} className="gradient-love border-0 rounded-xl h-8 px-4 text-xs">
                <Crown className="w-3 h-3 mr-1" />Upgrade
              </Button>
            )}
          </div>
        </div>

        {/* Boost */}
        <button onClick={onUpgrade} className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-border/30 mb-4 w-full text-left">
          <div className="w-10 h-10 rounded-xl bg-love-purple/10 flex items-center justify-center"><Zap className="w-5 h-5 text-love-purple" /></div>
          <div className="flex-1"><p className="text-sm font-semibold">{t("profile.boost")}</p><p className="text-[10px] text-muted-foreground">{t("profile.boostDesc")}</p></div>
        </button>

        {/* Referral */}
        <button onClick={copyReferral} className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-border/30 mb-4 w-full text-left">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center"><Share2 className="w-5 h-5 text-green-500" /></div>
          <div className="flex-1"><p className="text-sm font-semibold">{t("profile.referral")}</p><p className="text-[10px] text-muted-foreground">https://h-love-clean.vercel.app?ref={user?.referral_code || "HLOVE"}</p></div>
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Logout */}
        <button onClick={onLogout} className="flex items-center gap-3 p-4 bg-destructive/5 rounded-2xl border border-destructive/10 w-full text-left mt-2">
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t("profile.logout")}</span>
        </button>
      </div>
    );
  }
  