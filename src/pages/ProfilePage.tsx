import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Shield,
  Edit3,
  Save,
  LogOut,
  Heart,
  Star,
  TrendingUp,
  BarChart3,
  Share2,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTEREST_OPTIONS, MAX_PHOTOS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useStats } from "@/hooks/useStats";
import type { Profile, User } from "@/types";

interface ProfilePageProps {
  user: User;
  profile: Profile;
  onUpdate: (updates: Partial<Profile>) => Promise<any>;
  onLogout: () => void;
}

export default function ProfilePage({ user, profile, onUpdate, onLogout }: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: profile.display_name || "",
    bio: profile.bio || "",
    city: profile.city || "",
    interests: profile.interests || [],
    looking_for: profile.looking_for || "",
  });
  const [saving, setSaving] = useState(false);
  const { data: stats } = useStats(user.id);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(form);
    setEditing(false);
    setSaving(false);
  };

  const toggleInterest = useCallback((interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : prev.interests.length < 8
          ? [...prev.interests, interest]
          : prev.interests,
    }));
  }, []);

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || (profile.photos?.length || 0) >= MAX_PHOTOS) return;

      const newPhotos = [...(profile.photos || [])];
      for (const file of Array.from(files)) {
        if (newPhotos.length >= MAX_PHOTOS) break;
        const ext = file.name.split(".").pop();
        const path = `profiles/${user.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage
          .from("photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (!error) {
          const { data } = supabase.storage.from("photos").getPublicUrl(path);
          newPhotos.push(data.publicUrl);
        }
      }
      await onUpdate({ photos: newPhotos });
    },
    [user.id, profile.photos, onUpdate]
  );

  const referralLink = `https://hlove.app/join?ref=${user.referral_code}`;
  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="relative">
        <div className="h-32 gradient-love opacity-40" />
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-xl">
              <img
                src={profile.photos?.[0] || "/placeholder.jpg"}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gradient-love flex items-center justify-center shadow-md">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-16 pb-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">
            {profile.display_name}
            {user.is_premium && (
              <Star className="w-4 h-4 text-love-gold inline ml-1.5" fill="currentColor" />
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile.age} &middot; {profile.city}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Shield className="w-3 h-3 text-love-pink" />
            <span className="text-xs text-love-pink font-medium">Orb Verified</span>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Matches", value: stats.totalMatches, icon: Heart, color: "text-love-pink" },
              { label: "Super Likes", value: stats.totalSuperLikes, icon: Star, color: "text-love-gold" },
              { label: "Match Rate", value: `${stats.matchRate}%`, icon: TrendingUp, color: "text-love-purple" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-3 text-center">
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <div className="text-lg font-bold">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={editing ? handleSave : () => setEditing(true)}
            disabled={saving}
            className="flex-1 rounded-xl h-10"
          >
            {editing ? (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? "Saving..." : "Save"}
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Edit Profile
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={copyReferral}
            className="rounded-xl h-10"
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {editing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="bg-card border-border/50 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bio</label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="bg-card border-border/50 rounded-xl resize-none min-h-[100px]"
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="bg-card border-border/50 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Interests ({form.interests.length}/8)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1 rounded-full text-xs transition-all ${
                      form.interests.includes(interest)
                        ? "gradient-love text-white"
                        : "bg-card text-foreground/60 border border-border/50"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">About</h4>
              <p className="text-sm">{profile.bio || "No bio yet"}</p>
            </div>

            <div className="glass-card rounded-xl p-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Photos</h4>
              <div className="grid grid-cols-3 gap-2">
                {profile.photos?.map((photo, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {(profile.photos?.length || 0) < MAX_PHOTOS && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-love-pink/40 transition-colors">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {profile.interests && profile.interests.length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Interests</h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="text-xs bg-love-pink/10 text-love-pink px-2.5 py-1 rounded-full"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card rounded-xl p-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Referral Code</h4>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-love-gold bg-love-gold/10 px-3 py-1.5 rounded-lg flex-1">
                  {user.referral_code}
                </code>
                <Button size="sm" variant="outline" onClick={copyReferral} className="rounded-lg">
                  Copy
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Share your code — both of you get a free boost!
              </p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full mt-8 text-destructive hover:text-destructive rounded-xl"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
