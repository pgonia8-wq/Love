import { useState, useEffect } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Shield, Crown, Zap, Edit2, LogOut, Camera, Heart, Star, TrendingUp, Share2, Check, Copy, MapPin, Navigation, Plane, Globe, Lock, Settings } from "lucide-react";
  import { useI18n } from "@/lib/i18n";
  import { useGeolocation } from "@/hooks/useGeolocation";
  import { Button } from "@/components/ui/button";
  import { supabase } from "@/lib/supabase";
  import type { Profile, User as UserType } from "@/types";

  interface ProfilePageProps {
    user: UserType;
    profile: Profile;
    onUpdate: (updates: Partial<Profile>) => Promise<any>;
    onLogout: () => void;
    onUpgrade: () => void;
  }

  const TRAVEL_CITIES = [
    { city: "Mexico City", country: "Mexico", code: "MX", lat: 19.4326, lng: -99.1332, flag: "\u{1F1F2}\u{1F1FD}" },
    { city: "Bogota", country: "Colombia", code: "CO", lat: 4.711, lng: -74.0721, flag: "\u{1F1E8}\u{1F1F4}" },
    { city: "Buenos Aires", country: "Argentina", code: "AR", lat: -34.6037, lng: -58.3816, flag: "\u{1F1E6}\u{1F1F7}" },
    { city: "Lima", country: "Peru", code: "PE", lat: -12.0464, lng: -77.0428, flag: "\u{1F1F5}\u{1F1EA}" },
    { city: "Madrid", country: "Spain", code: "ES", lat: 40.4168, lng: -3.7038, flag: "\u{1F1EA}\u{1F1F8}" },
    { city: "Santiago", country: "Chile", code: "CL", lat: -33.4489, lng: -70.6693, flag: "\u{1F1E8}\u{1F1F1}" },
    { city: "Medellin", country: "Colombia", code: "CO", lat: 6.2476, lng: -75.5658, flag: "\u{1F1E8}\u{1F1F4}" },
    { city: "Barcelona", country: "Spain", code: "ES", lat: 41.3874, lng: 2.1686, flag: "\u{1F1EA}\u{1F1F8}" },
    { city: "Cancun", country: "Mexico", code: "MX", lat: 21.1619, lng: -86.8515, flag: "\u{1F1F2}\u{1F1FD}" },
    { city: "Montevideo", country: "Uruguay", code: "UY", lat: -34.9011, lng: -56.1645, flag: "\u{1F1FA}\u{1F1FE}" },
    { city: "Panama City", country: "Panama", code: "PA", lat: 8.9824, lng: -79.5199, flag: "\u{1F1F5}\u{1F1E6}" },
    { city: "Quito", country: "Ecuador", code: "EC", lat: -0.1807, lng: -78.4678, flag: "\u{1F1EA}\u{1F1E8}" },
  ];

  export default function ProfilePage({ user, profile, onUpdate, onLogout, onUpgrade }: ProfilePageProps) {
    const { t } = useI18n();
    const { position } = useGeolocation();
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(profile.display_name || "");
    const [editBio, setEditBio] = useState(profile.bio || "");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [maxDistance, setMaxDistance] = useState(() => parseInt(localStorage.getItem("hlove_max_dist") || "50"));
    const [showTravel, setShowTravel] = useState(false);
    const [travelActive, setTravelActive] = useState(false);
    const [travelCity, setTravelCity] = useState<string | null>(null);

    const isPremium = user?.is_premium || false;

    useEffect(() => {
      const loadTravelStatus = async () => {
        const { data } = await supabase.from("profiles").select("travel_active, travel_city, max_distance_km").eq("user_id", profile.user_id).single();
        if (data) {
          setTravelActive(data.travel_active || false);
          setTravelCity(data.travel_city || null);
          if (data.max_distance_km) setMaxDistance(data.max_distance_km);
        }
      };
      loadTravelStatus();
    }, [profile.user_id]);

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

    const updateDistance = async (d: number) => {
      setMaxDistance(d);
      localStorage.setItem("hlove_max_dist", String(d));
      fetch("/api/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-distance", user_id: profile.user_id, max_distance_km: d }) }).catch(() => {});
    };

    const activateTravel = async (dest: typeof TRAVEL_CITIES[0]) => {
      if (!isPremium) { onUpgrade(); return; }
      try {
        const r = await fetch("/api/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "travel-mode", user_id: profile.user_id, enabled: true, travel_city: dest.city, travel_country: dest.country, travel_country_code: dest.code, travel_lat: dest.lat, travel_lng: dest.lng }) });
        const data = await r.json();
        if (data.success) { setTravelActive(true); setTravelCity(dest.city); setShowTravel(false); }
      } catch {}
    };

    const deactivateTravel = async () => {
      try {
        await fetch("/api/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "travel-mode", user_id: profile.user_id, enabled: false }) });
        setTravelActive(false); setTravelCity(null);
      } catch {}
    };

    const stats = [
      { label: t("profile.matches"), value: "—", icon: Heart },
      { label: t("profile.superLikes"), value: "—", icon: Star },
      { label: t("profile.matchRate"), value: "—", icon: TrendingUp },
    ];

    return (
      <div className="flex flex-col px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-6 pt-2">
          <h2 className="text-2xl font-bold">{t("profile.editProfile")}</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Edit2 className="w-4 h-4" /></button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-love border-0 rounded-xl h-9 px-4 text-xs font-medium">{saving ? t("profile.saving") : t("profile.save")}</Button>
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
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] text-white/60">{t("profile.orbVerified")}</span></div>
                {position && <span className="text-[10px] text-white/50 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{position.city}, {position.country}</span>}
                {travelActive && <span className="text-[10px] text-love-purple flex items-center gap-0.5"><Plane className="w-2.5 h-2.5" />{travelCity}</span>}
              </div>
            </div>
            <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center"><Camera className="w-4 h-4 text-white" /></button>
          </div>
          {editing ? (
            <div className="p-4 space-y-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">{t("profile.name")}</label><input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-love-pink/50" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">{t("profile.bio")}</label><textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-love-pink/50 min-h-[80px] resize-none" /></div>
            </div>
          ) : (
            <div className="p-4">
              {profile.bio && <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>}
              {profile.interests?.length > 0 && <div className="flex flex-wrap gap-1.5">{profile.interests.map(i => <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{i}</span>)}</div>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {stats.map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/30 p-3 text-center">
              <stat.icon className="w-4 h-4 text-love-pink mx-auto mb-1" /><p className="text-lg font-bold">{stat.value}</p><p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Distance setting */}
        <div className="bg-card rounded-2xl border border-border/30 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-love-pink" />
            <span className="text-sm font-semibold">{t("profile.distanceRange", { km: maxDistance })}</span>
          </div>
          <input type="range" min="5" max="500" step="5" value={maxDistance} onChange={e => updateDistance(parseInt(e.target.value))} className="w-full accent-love-pink" />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>5km</span><span>100km</span><span>500km</span></div>
          {position && <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" />{t("profile.currentLocation", { city: position.city || "—", country: position.country || "—" })}</p>}
        </div>

        {/* Travel Mode */}
        <div className={"rounded-2xl border p-4 mb-4 " + (travelActive ? "bg-love-purple/5 border-love-purple/20" : "bg-card border-border/30")}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Plane className={"w-5 h-5 " + (travelActive ? "text-love-purple" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-semibold">{t("geo.travelMode")}</p>
                <p className="text-[10px] text-muted-foreground">{travelActive ? t("geo.travelModeActive", { city: travelCity || "" }) : t("geo.travelModeDesc")}</p>
              </div>
            </div>
            {!isPremium && <Lock className="w-4 h-4 text-muted-foreground" />}
          </div>
          {travelActive ? (
            <Button variant="outline" size="sm" onClick={deactivateTravel} className="w-full mt-2 rounded-xl h-8 text-xs">{t("geo.deactivateTravel")}</Button>
          ) : (
            <Button size="sm" onClick={() => isPremium ? setShowTravel(true) : onUpgrade()} className={"w-full mt-2 rounded-xl h-8 text-xs " + (isPremium ? "gradient-love border-0" : "")}>
              {isPremium ? <><Plane className="w-3 h-3 mr-1" />{t("geo.selectDestination")}</> : <><Crown className="w-3 h-3 mr-1" />{t("geo.travelModePremium")}</>}
            </Button>
          )}
        </div>

        {/* Travel destination picker */}
        <AnimatePresence>
          {showTravel && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTravel(false)}>
              <motion.div initial={{y:300}} animate={{y:0}} exit={{y:300}} onClick={e => e.stopPropagation()} className="bg-card rounded-t-3xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto border-t border-border/50">
                <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
                <h4 className="font-bold mb-1 flex items-center gap-2"><Globe className="w-5 h-5 text-love-purple" />{t("geo.passport")}</h4>
                <p className="text-xs text-muted-foreground mb-4">{t("geo.passportDesc")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {TRAVEL_CITIES.map(dest => (
                    <button key={dest.city} onClick={() => activateTravel(dest)} className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl hover:bg-muted/60 transition text-left">
                      <span className="text-lg">{dest.flag}</span>
                      <div><p className="text-sm font-medium">{dest.city}</p><p className="text-[10px] text-muted-foreground">{dest.country}</p></div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photos grid */}
        {profile.photos?.length > 1 && (
          <div className="mb-5"><h4 className="text-sm font-semibold mb-2">{t("profile.photos")}</h4>
            <div className="grid grid-cols-3 gap-2">{profile.photos.map((photo, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden relative"><img src={photo} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 text-[8px] bg-love-pink/80 text-white px-1.5 py-0.5 rounded-full">Main</span>}
              </div>
            ))}</div>
          </div>
        )}

        {/* Premium */}
        <div className={"rounded-2xl border p-4 mb-4 " + (isPremium ? "bg-love-gold/5 border-love-gold/20" : "bg-muted/30 border-border/30")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Crown className={"w-5 h-5 " + (isPremium ? "text-love-gold" : "text-muted-foreground")} /><div><p className="text-sm font-semibold">{t("profile.premium")}</p><p className="text-[10px] text-muted-foreground">{isPremium ? t("profile.premiumMember") : t("profile.getPremium")}</p></div></div>
            {!isPremium && <Button size="sm" onClick={onUpgrade} className="gradient-love border-0 rounded-xl h-8 px-4 text-xs"><Crown className="w-3 h-3 mr-1" />Upgrade</Button>}
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
          <LogOut className="w-5 h-5 text-destructive" /><span className="text-sm font-medium text-destructive">{t("profile.logout")}</span>
        </button>
      </div>
    );
  }
  