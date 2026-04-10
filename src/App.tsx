import { useState, useEffect } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";
  import { Heart, Calendar, User, Flame } from "lucide-react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { I18nProvider, LanguageSelector, useI18n } from "@/lib/i18n";
  import LandingPage from "@/pages/LandingPage";
  import OnboardingPage from "@/pages/OnboardingPage";
  import SwipePage from "@/pages/SwipePage";
  import MatchesPage from "@/pages/MatchesPage";
  import EventsPage from "@/pages/EventsPage";
  import ProfilePage from "@/pages/ProfilePage";
  import PremiumModal from "@/components/PremiumModal";
  import { supabase } from "@/lib/supabase";
  import type { Profile, User as UserType } from "@/types";

  const queryClient = new QueryClient();
  type Tab = "swipe" | "matches" | "events" | "profile";

  function AppContent() {
    const { t } = useI18n();
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [userRecord, setUserRecord] = useState<UserType | null>(null);
    const [verified, setVerified] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("swipe");
    const [showPremium, setShowPremium] = useState(false);

    useEffect(() => {
      const init = async () => {
        console.log("[App] Init started");
        try {
          if (!MiniKit.isInstalled()) {
            await new Promise<void>((resolve) => {
              let attempts = 0;
              const interval = setInterval(() => {
                attempts++;
                if (MiniKit.isInstalled() || attempts > 20) { clearInterval(interval); resolve(); }
              }, 250);
            });
          }
          console.log("[App] MiniKit installed:", MiniKit.isInstalled());
        } catch (e) { console.warn("[App] MiniKit init:", e); }

        const storedWallet = localStorage.getItem("hlove_wallet");
        if (storedWallet) {
          try {
            const checkRes = await fetch("/api/verify?wallet=" + encodeURIComponent(storedWallet));
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.valid) {
                setWalletAddress(storedWallet);
                setUsername(localStorage.getItem("hlove_username") || checkData.user?.username || null);
                setVerified(true);
                await loadUserAndProfile(storedWallet);
              } else {
                localStorage.removeItem("hlove_wallet");
                localStorage.removeItem("hlove_nullifier");
                localStorage.removeItem("hlove_username");
              }
            } else {
              setWalletAddress(storedWallet);
              setVerified(true);
              await loadUserAndProfile(storedWallet);
            }
          } catch (e) {
            setWalletAddress(storedWallet);
            setVerified(true);
            await loadUserAndProfile(storedWallet);
          }
        }
        setLoading(false);
      };
      init();
    }, []);

    const loadUserAndProfile = async (wallet: string) => {
      try {
        const { data: userData } = await supabase.from("users").select("*").eq("wallet_address", wallet).maybeSingle();
        if (userData) setUserRecord(userData as UserType);
        const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", wallet).maybeSingle();
        if (profileData) { setProfile(profileData); console.log("[App] Profile loaded:", profileData.display_name); }
      } catch (err) { console.warn("[App] Load error:", err); }
    };

    const handleVerified = async (wallet: string, nullifier: string, user: string | null) => {
      setWalletAddress(wallet);
      setUsername(user);
      setVerified(true);
      await loadUserAndProfile(wallet);
    };

    const handleOnboardingComplete = (newProfile: Profile) => { setProfile(newProfile); };

    const handleProfileUpdate = async (updates: Partial<Profile>) => {
      if (!walletAddress) return;
      const { data, error } = await supabase.from("profiles").update(updates).eq("user_id", walletAddress).select().single();
      if (!error && data) setProfile(data);
      return { data, error };
    };

    const handlePremiumPurchased = async () => {
      if (!walletAddress) return;
      await supabase.from("users").update({ is_premium: true, premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("wallet_address", walletAddress);
      const { data } = await supabase.from("users").select("*").eq("wallet_address", walletAddress).single();
      if (data) setUserRecord(data as UserType);
      setShowPremium(false);
    };

    const handleLogout = () => {
      localStorage.removeItem("hlove_wallet");
      localStorage.removeItem("hlove_nullifier");
      localStorage.removeItem("hlove_username");
      setWalletAddress(null); setUsername(null); setVerified(false);
      setProfile(null); setUserRecord(null);
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-love flex items-center justify-center animate-pulse"><Heart className="w-8 h-8 text-white" fill="white" /></div>
            <div className="w-8 h-8 border-2 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
          </div>
        </div>
      );
    }

    if (!verified) return <LandingPage onVerified={handleVerified} />;
    if (!profile && walletAddress) return <OnboardingPage userId={walletAddress} username={username} onComplete={handleOnboardingComplete} />;
    if (!walletAddress || !profile) return null;

    const isPremium = userRecord?.is_premium || false;
    const tabs: { id: Tab; icon: typeof Heart; label: string }[] = [
      { id: "swipe", icon: Flame, label: t("nav.discover") },
      { id: "matches", icon: Heart, label: t("nav.matches") },
      { id: "events", icon: Calendar, label: t("nav.events") },
      { id: "profile", icon: User, label: t("nav.profile") },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="absolute top-3 right-3 z-40"><LanguageSelector /></div>

        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "swipe" && <SwipePage userId={walletAddress} isPremium={isPremium} onUpgrade={() => setShowPremium(true)} />}
          {activeTab === "matches" && <MatchesPage userId={walletAddress} />}
          {activeTab === "events" && <EventsPage userId={walletAddress} />}
          {activeTab === "profile" && <ProfilePage user={userRecord!} profile={profile} onUpdate={handleProfileUpdate} onLogout={handleLogout} onUpgrade={() => setShowPremium(true)} />}
        </div>

        <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} userId={walletAddress} onPurchased={handlePremiumPurchased} />

        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 px-2 pb-safe z-50">
          <div className="flex justify-around py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.id ? "text-love-pink" : "text-muted-foreground hover:text-foreground/70"}`}>
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "fill-love-pink/20" : ""}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  export default function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AppContent />
        </I18nProvider>
      </QueryClientProvider>
    );
  }
  