import { useState, useEffect } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";
  import { Heart, Calendar, User, Flame } from "lucide-react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import LandingPage from "@/pages/LandingPage";
  import OnboardingPage from "@/pages/OnboardingPage";
  import SwipePage from "@/pages/SwipePage";
  import MatchesPage from "@/pages/MatchesPage";
  import EventsPage from "@/pages/EventsPage";
  import ProfilePage from "@/pages/ProfilePage";
  import { supabase } from "@/lib/supabase";
  import type { Profile, User as UserType } from "@/types";

  const queryClient = new QueryClient();

  type Tab = "swipe" | "matches" | "events" | "profile";

  function AppContent() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [userRecord, setUserRecord] = useState<UserType | null>(null);
    const [verified, setVerified] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("swipe");

    useEffect(() => {
      const init = async () => {
        console.log("[App] Init started");

        // Wait for MiniKit
        try {
          if (!MiniKit.isInstalled()) {
            await new Promise<void>((resolve) => {
              let attempts = 0;
              const interval = setInterval(() => {
                attempts++;
                if (MiniKit.isInstalled() || attempts > 20) {
                  clearInterval(interval);
                  resolve();
                }
              }, 250);
            });
          }
          console.log("[App] MiniKit installed:", MiniKit.isInstalled());
          if (MiniKit.user) {
            console.log("[App] MiniKit.user:", JSON.stringify({
              username: MiniKit.user.username,
              walletAddress: MiniKit.user.walletAddress,
            }));
          }
        } catch (e) {
          console.warn("[App] MiniKit init:", e);
        }

        // Check stored session
        const storedWallet = localStorage.getItem("hlove_wallet");
        const storedUsername = localStorage.getItem("hlove_username");
        console.log("[App] Stored wallet:", storedWallet?.slice(0, 10));

        if (storedWallet) {
          try {
            const checkRes = await fetch("/api/verify?wallet=" + encodeURIComponent(storedWallet));
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.valid) {
                setWalletAddress(storedWallet);
                setUsername(storedUsername || checkData.user?.username || null);
                setVerified(true);
                await loadUserAndProfile(storedWallet);
                console.log("[App] Session restored:", storedWallet.slice(0, 10));
              } else {
                localStorage.removeItem("hlove_wallet");
                localStorage.removeItem("hlove_nullifier");
                localStorage.removeItem("hlove_username");
              }
            } else {
              // Backend down, trust local storage
              setWalletAddress(storedWallet);
              setUsername(storedUsername || null);
              setVerified(true);
              await loadUserAndProfile(storedWallet);
            }
          } catch (e) {
            // Offline fallback
            setWalletAddress(storedWallet);
            setUsername(storedUsername || null);
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
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("wallet_address", wallet)
          .maybeSingle();

        if (userData) {
          setUserRecord(userData as UserType);
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", wallet)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
          console.log("[App] Profile loaded:", profileData.display_name);
        } else {
          console.log("[App] No profile, will show onboarding");
        }
      } catch (err) {
        console.warn("[App] Load error:", err);
      }
    };

    const handleVerified = async (wallet: string, nullifier: string, user: string | null) => {
      setWalletAddress(wallet);
      setUsername(user);
      setVerified(true);
      await loadUserAndProfile(wallet);
    };

    const handleOnboardingComplete = (newProfile: Profile) => {
      setProfile(newProfile);
      console.log("[App] Onboarding complete:", newProfile.display_name);
    };

    const handleProfileUpdate = async (updates: Partial<Profile>) => {
      if (!walletAddress) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", walletAddress)
        .select()
        .single();
      if (!error && data) setProfile(data);
      return { data, error };
    };

    const handleLogout = () => {
      localStorage.removeItem("hlove_wallet");
      localStorage.removeItem("hlove_nullifier");
      localStorage.removeItem("hlove_username");
      setWalletAddress(null);
      setUsername(null);
      setVerified(false);
      setProfile(null);
      setUserRecord(null);
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-love flex items-center justify-center animate-pulse">
              <Heart className="w-8 h-8 text-white" fill="white" />
            </div>
            <div className="w-8 h-8 border-2 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
          </div>
        </div>
      );
    }

    if (!verified) {
      return <LandingPage onVerified={handleVerified} />;
    }

    if (!profile && walletAddress) {
      return (
        <OnboardingPage
          userId={walletAddress}
          username={username}
          onComplete={handleOnboardingComplete}
        />
      );
    }

    if (!walletAddress || !profile) return null;

    const tabs: { id: Tab; icon: typeof Heart; label: string }[] = [
      { id: "swipe", icon: Flame, label: "Discover" },
      { id: "matches", icon: Heart, label: "Matches" },
      { id: "events", icon: Calendar, label: "Events" },
      { id: "profile", icon: User, label: "Profile" },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "swipe" && (
            <SwipePage userId={walletAddress} isPremium={userRecord?.is_premium || false} />
          )}
          {activeTab === "matches" && <MatchesPage userId={walletAddress} />}
          {activeTab === "events" && <EventsPage userId={walletAddress} />}
          {activeTab === "profile" && (
            <ProfilePage
              user={userRecord!}
              profile={profile}
              onUpdate={handleProfileUpdate}
              onLogout={handleLogout}
            />
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 px-2 pb-safe z-50">
          <div className="flex justify-around py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "text-love-pink"
                    : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                <tab.icon
                  className={`w-5 h-5 ${activeTab === tab.id ? "fill-love-pink/20" : ""}`}
                />
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
        <AppContent />
      </QueryClientProvider>
    );
  }
  