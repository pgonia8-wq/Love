import { useState, useCallback } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Camera, ChevronRight, ChevronLeft, Check, MapPin } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Textarea } from "@/components/ui/textarea";
  import { INTEREST_OPTIONS, MIN_AGE, MAX_PHOTOS } from "@/lib/constants";
  import { supabase } from "@/lib/supabase";
  import type { Profile } from "@/types";

  interface OnboardingPageProps {
    userId: string;
    username?: string | null;
    onComplete: (profile: Profile) => void;
  }

  export default function OnboardingPage({ userId, username, onComplete }: OnboardingPageProps) {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
      display_name: username || "",
      bio: "",
      age: "",
      gender: "",
      looking_for: "",
      interests: [] as string[],
      photos: [] as string[],
      city: "",
    });

    const totalSteps = 4;
    const updateField = useCallback((field: string, value: any) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const toggleInterest = useCallback((interest: string) => {
      setForm((prev) => ({
        ...prev,
        interests: prev.interests.includes(interest)
          ? prev.interests.filter((i) => i !== interest)
          : prev.interests.length < 8 ? [...prev.interests, interest] : prev.interests,
      }));
    }, []);

    const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || form.photos.length >= MAX_PHOTOS) return;
      for (const file of Array.from(files)) {
        if (form.photos.length >= MAX_PHOTOS) break;
        const ext = file.name.split(".").pop();
        const path = "profiles/" + userId + "/" + Date.now() + "." + ext;
        const { error: uploadErr } = await supabase.storage.from("photos").upload(path, file, { cacheControl: "3600", upsert: false });
        if (!uploadErr) {
          const { data } = supabase.storage.from("photos").getPublicUrl(path);
          setForm((prev) => ({ ...prev, photos: [...prev.photos, data.publicUrl] }));
        }
      }
    }, [userId, form.photos.length]);

    const removePhoto = useCallback((index: number) => {
      setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
    }, []);

    const handleSave = async () => {
      setSaving(true);
      setError(null);
      try {
        console.log("[Onboarding] Saving for wallet:", userId.slice(0, 10));
        const { data, error: saveError } = await supabase.from("profiles").upsert({
          user_id: userId,
          display_name: form.display_name,
          bio: form.bio,
          age: parseInt(form.age),
          gender: form.gender,
          looking_for: form.looking_for,
          interests: form.interests,
          photos: form.photos,
          city: form.city,
          is_active: true,
          last_active_at: new Date().toISOString(),
        }, { onConflict: "user_id" }).select().single();
        if (saveError) { console.error("[Onboarding]", saveError.message); setError(saveError.message); return; }
        if (data) { console.log("[Onboarding] Done:", data.display_name); onComplete(data); }
      } catch (err) { console.error("[Onboarding]", err); setError("Error inesperado"); }
      finally { setSaving(false); }
    };

    const canProceed = () => {
      switch (step) {
        case 0: return form.display_name.trim().length >= 2 && parseInt(form.age) >= MIN_AGE && form.gender !== "";
        case 1: return form.bio.trim().length >= 10 && form.interests.length >= 3;
        case 2: return form.photos.length >= 1;
        case 3: return form.city.trim().length >= 2 && form.looking_for !== "";
        default: return false;
      }
    };

    const stepTitles = ["Who are you?", "Tell us more", "Show yourself", "Preferences"];
    const slides = [
      <div key="basics" className="space-y-5">
        <div><label className="text-sm font-medium text-foreground/70 mb-1.5 block">Display Name</label><Input value={form.display_name} onChange={(e) => updateField("display_name", e.target.value)} placeholder="How should people call you?" className="h-12 bg-card border-border/50 rounded-xl" maxLength={30} /></div>
        <div><label className="text-sm font-medium text-foreground/70 mb-1.5 block">Age</label><Input type="number" value={form.age} onChange={(e) => updateField("age", e.target.value)} placeholder="Your age (18+)" min={MIN_AGE} max={99} className="h-12 bg-card border-border/50 rounded-xl" /></div>
        <div><label className="text-sm font-medium text-foreground/70 mb-2 block">Gender</label>
          <div className="grid grid-cols-3 gap-3">{["Male", "Female", "Other"].map((g) => (<button key={g} onClick={() => updateField("gender", g.toLowerCase())} className={`py-3 rounded-xl text-sm font-medium transition-all ${form.gender === g.toLowerCase() ? "gradient-love text-white shadow-md" : "bg-card text-foreground/70 border border-border/50"}`}>{g}</button>))}</div>
        </div>
      </div>,
      <div key="about" className="space-y-5">
        <div><label className="text-sm font-medium text-foreground/70 mb-1.5 block">About you</label><Textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} placeholder="Tell people something interesting..." className="min-h-[120px] bg-card border-border/50 rounded-xl resize-none" maxLength={500} /><span className="text-xs text-muted-foreground mt-1 block">{form.bio.length}/500</span></div>
        <div><label className="text-sm font-medium text-foreground/70 mb-2 block">Interests ({form.interests.length}/8)</label>
          <div className="flex flex-wrap gap-2">{INTEREST_OPTIONS.map((interest) => (<button key={interest} onClick={() => toggleInterest(interest)} className={`px-3.5 py-1.5 rounded-full text-sm transition-all ${form.interests.includes(interest) ? "gradient-love text-white shadow-sm" : "bg-card text-foreground/60 border border-border/50"}`}>{interest}</button>))}</div>
        </div>
      </div>,
      <div key="photos" className="space-y-5">
        <p className="text-sm text-muted-foreground">Add up to {MAX_PHOTOS} photos. First = main picture.</p>
        <div className="grid grid-cols-3 gap-3">
          {form.photos.map((photo, i) => (<div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden group"><img src={photo} alt="" className="w-full h-full object-cover" /><button onClick={() => removePhoto(i)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-xs">X</button>{i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2"><span className="text-[10px] text-white font-medium">Main</span></div>}</div>))}
          {form.photos.length < MAX_PHOTOS && (<label className="aspect-[3/4] rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center cursor-pointer hover:border-love-pink/40"><Camera className="w-6 h-6 text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Add</span><input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} /></label>)}
        </div>
      </div>,
      <div key="preferences" className="space-y-5">
        <div><label className="text-sm font-medium text-foreground/70 mb-2 block">Looking for</label>
          <div className="grid grid-cols-2 gap-3">{["Men", "Women", "Everyone", "Friends"].map((pref) => (<button key={pref} onClick={() => updateField("looking_for", pref.toLowerCase())} className={`py-3 rounded-xl text-sm font-medium transition-all ${form.looking_for === pref.toLowerCase() ? "gradient-love text-white shadow-md" : "bg-card text-foreground/70 border border-border/50"}`}>{pref}</button>))}</div>
        </div>
        <div><label className="text-sm font-medium text-foreground/70 mb-1.5 block"><MapPin className="w-4 h-4 inline mr-1" />City</label><Input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Your city" className="h-12 bg-card border-border/50 rounded-xl" /></div>
      </div>,
    ];

    return (
      <div className="min-h-screen flex flex-col px-6 py-8">
        <div className="flex items-center gap-2 mb-2">{Array.from({ length: totalSteps }).map((_, i) => (<div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? "gradient-love" : "bg-muted"}`} />))}</div>
        <div className="flex-1 flex flex-col">
          <motion.h2 key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-bold mt-6 mb-6 gradient-love-text">{stepTitles[step]}</motion.h2>
          <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="flex-1">{slides[step]}</motion.div></AnimatePresence>
          <AnimatePresence>{error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-destructive text-center">{error}</motion.p>}</AnimatePresence>
          <div className="flex gap-3 mt-8 pb-4">
            {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1 h-12 rounded-xl"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>}
            <Button onClick={step === totalSteps - 1 ? handleSave : () => setStep((s) => s + 1)} disabled={!canProceed() || saving} className="flex-1 h-12 gradient-love border-0 rounded-xl font-semibold">
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : step === totalSteps - 1 ? <><Check className="w-4 h-4 mr-1" />Complete</> : <>Next<ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  