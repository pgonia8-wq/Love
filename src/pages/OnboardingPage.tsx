import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, LanguageSelector } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface OnboardingPageProps {
  userId: string;
  username?: string | null;
  onComplete: (profile: Profile) => void;
}

const INTEREST_OPTIONS = [
  "Travel", "Music", "Fitness", "Photography", "Cooking", "Art",
  "Reading", "Gaming", "Movies", "Dancing", "Yoga", "Hiking",
  "Tech", "Fashion", "Coffee", "Wine", "Pets", "Nature",
  "Sports", "Meditation", "Writing", "Volunteering", "Startups", "Design",
];

export default function OnboardingPage({ userId, username, onComplete }: OnboardingPageProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(username || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male"|"female"|"other">("male");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<"men"|"women"|"everyone">("everyone");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  console.log("[Onboarding] Rendered. step:", step, "userId:", userId, "username:", username);

  const toggleInterest = (interest: string) => {
    setInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : prev.length < 8 ? [...prev, interest] : prev);
  };

  const addPhoto = () => {
    const url = prompt("Photo URL:");
    if (url && url.startsWith("http") && photos.length < 6) setPhotos(prev => [...prev, url]);
  };

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const handleComplete = useCallback(async () => {
    if (!name.trim() || !age || parseInt(age) < 18) {
      console.warn("[Onboarding] Validation failed: name:", name, "age:", age);
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const profileData = {
        user_id: userId,
        display_name: name.trim(),
        age: parseInt(age),
        gender,
        bio: bio.trim() || null,
        interests,
        photos: photos.length > 0 ? photos : ["https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=500&fit=crop"],
        looking_for: lookingFor,
        city: city.trim() || null,
        is_active: true,
        last_active_at: new Date().toISOString(),
      };

      console.log("[Onboarding] Saving profile:", JSON.stringify(profileData));
      const { data, error: dbError } = await supabase.from("profiles").upsert(profileData, { onConflict: "user_id" }).select().single();

      if (dbError) {
        console.error("[Onboarding] DB Error:", dbError.message, dbError.details);
        setError(dbError.message);
        setSaving(false);
        return;
      }

      console.log("[Onboarding] Profile saved successfully:", data?.display_name);
      if (data) onComplete(data);
    } catch (err) {
      console.error("[Onboarding] Exception:", err);
      setError(err instanceof Error ? err.message : t("onboarding.errorSaving"));
      setSaving(false);
    }
  }, [userId, name, age, gender, bio, interests, photos, lookingFor, city, onComplete]);

  const steps = [t("onboarding.step1"), t("onboarding.step2"), t("onboarding.step3"), t("onboarding.step4")];

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "hsl(270 20% 7%)" }}>
      <div className="absolute top-4 right-4 z-40"><LanguageSelector /></div>

      <div className="px-6 pt-8 pb-4">
        <div className="flex gap-1.5 mb-3">
          {steps.map((_, i) => (<div key={i} className={"h-1 flex-1 rounded-full transition-all " + (i + 1 <= step ? "gradient-love" : "bg-muted")} />))}
        </div>
        <p className="text-xs text-muted-foreground">{step}/4 — {steps[step - 1]}</p>
      </div>

      <div className="flex-1 px-6 py-4 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("onboarding.displayName")}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t("onboarding.displayNamePlaceholder")} className="w-full bg-card border border-border/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-love-pink/30" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("onboarding.age")}</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder={t("onboarding.agePlaceholder")} min="18" max="99" className="w-full bg-card border border-border/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-love-pink/30" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("onboarding.gender")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["male","female","other"] as const).map(g => (
                    <button key={g} onClick={() => setGender(g)} className={"py-3 rounded-xl text-sm font-medium transition-all border " + (gender === g ? "gradient-love text-white border-transparent" : "bg-card border-border/50")}>
                      {t("onboarding." + g)}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("onboarding.aboutYou")}</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder={t("onboarding.aboutPlaceholder")} maxLength={500} className="w-full bg-card border border-border/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-love-pink/30 min-h-[100px] resize-none" />
                <p className="text-right text-[10px] text-muted-foreground mt-1">{bio.length}/500</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("onboarding.interests")} ({interests.length}/8)</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map(i => (
                    <button key={i} onClick={() => toggleInterest(i)} className={"px-3 py-1.5 rounded-full text-xs font-medium transition-all border " + (interests.includes(i) ? "gradient-love text-white border-transparent" : "bg-card border-border/50 hover:border-love-pink/30")}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("onboarding.addPhotos", { max: "6" })}</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden relative group">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">x</button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[8px] bg-love-pink/80 text-white px-1.5 py-0.5 rounded-full">{t("onboarding.main")}</span>}
                  </div>
                ))}
                {photos.length < 6 && (
                  <button onClick={addPhoto} className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1 hover:border-love-pink/30 transition">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{t("onboarding.add")}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {step === 4 && (
            <motion.div key="s4" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("onboarding.lookingFor")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["men","women","everyone"] as const).map(opt => (
                    <button key={opt} onClick={() => setLookingFor(opt)} className={"py-3 rounded-xl text-sm font-medium transition-all border " + (lookingFor === opt ? "gradient-love text-white border-transparent" : "bg-card border-border/50")}>
                      {t("onboarding." + opt)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("onboarding.city")}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder={t("onboarding.cityPlaceholder")} className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-love-pink/30" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="px-6 text-sm text-destructive text-center mb-2">{error}</p>}

      <div style={{ flexShrink: 0, padding: "16px 24px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }} className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-12 rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" />{t("onboarding.back")}
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && (!name.trim() || !age || parseInt(age) < 18)} className="flex-1 h-12 gradient-love border-0 rounded-xl font-semibold">
            {t("onboarding.next")}<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={saving} className="flex-1 h-12 gradient-love border-0 rounded-xl font-semibold">
            {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="w-4 h-4 mr-1" />{t("onboarding.complete")}</>}
          </Button>
        )}
      </div>
    </div>
  );
}
