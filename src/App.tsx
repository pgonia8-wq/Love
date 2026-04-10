import { useState, useEffect, useRef } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";
  import { Heart, MessageCircle, Calendar, User, Flame } from "lucide-react";
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
    const [userId, setUserId] = useState<string | null>(null);
    const [nullifierHash, setNullifierHash] = useState<string | null>(null);
    const [userRecord, setUserRecord] = useState<UserType | null>(null);
    const [verified, setVerified] = useState(false);
    const [wallet, setWallet] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("swipe");
    const [isPremium, setIsPremium] = useState(false);
    const [miniKitReady, setMiniKitReady] = useState(false);
    const walletLoading = useRef(false);

    useEffect(() => {
      const init = async () => {
        console.log("[App] Init started");

        try {
          if (!MiniKit.isInstalled()) {
            const waitForMiniKit = () =>
              new Promise<boolean>((resolve) => {
                let attempts = 0;
                const interval = setInterval(() => {
                  attempts++;
                  if (MiniKit.isInstalled()) { clearInterval(interval); resolve(true); }
                  else if (attempts > 20) { clearInterval(interval); resolve(false); }
                }, 250);
              });
            await waitForMiniKit();
          }
          setMiniKitReady(MiniKit.isInstalled());

          if (MiniKit.user) {
            const u = MiniKit.user.username || null;
            if (u) setUsername(u);
            console.log("[App] MiniKit.user:", JSON.stringify({ username: MiniKit.user.username }));
          }
        } catch (e) {
          console.warn("[App] MiniKit init error:", e);
        }

        const storedId = localStorage.getItem("hlove_user_id");
        const storedNullifier = localStorage.getItem("hlove_nullifier");
        console.log("[App] stored userId:", storedId, "nullifier:", storedNullifier?.slice(0, 12));

        if (storedId) {
          try {
            const checkRes = await fetch(`/api/verify?userId=${storedNullifier || storedId}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.valid) {
                setUserId(checkData.user_id || storedId);
                setNullifierHash(storedNullifier || null);
                setVerified(true);
                await loadProfile(checkData.user_id || storedId);
                console.log("[App] ✅ Session restored, UUID:", checkData.user_id || storedId);
              } else {
                localStorage.removeItem("hlove_user_id");
                localStorage.removeItem("hlove_nullifier");
              }
            } else {
              setUserId(storedId);
              setNullifierHash(storedNullifier || null);
              setVerified(true);
              await loadProfile(storedId);
            }
          } catch (e) {
            setUserId(storedId);
            setVerified(true);
            await loadProfile(storedId);
          }
        }

        setLoading(false);
      };

      init();
    }, []);

    const loadProfile = async (uid: string) => {
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", uid)
          .maybeSingle();

        if (userData) {
          setUserRecord(userData as UserType);
          setIsPremium(userData.is_premium || false);
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
          console.log("[App] Profile loaded:", profileData.display_name);
        } else {
          console.log("[App] No profile found, will show onboarding");
        }
      } catch (err) {
        console.warn("[App] Error loading profile:", err);
      }
    };

    useEffect(() => {
      const loadWallet = async () => {
        if (!verified || wallet || !miniKitReady || walletLoading.current) return;
        walletLoading.current = true;

        try {
          console.log("[App] Fetching /api/nonce...");
          const nonceRes = await fetch("/api/nonce");
          if (!nonceRes.ok) throw new Error("No nonce");
          const { nonce } = await nonceRes.json();
          console.log("[App] Nonce:", nonce?.slice(0, 8) + "...");

          console.log("[App] Calling walletAuth...");
          const auth = await MiniKit.commandsAsync.walletAuth({
            nonce,
            requestId: "wallet-auth-" + Date.now(),
            expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            notBefore: new Date(Date.now() - 60 * 1000),
            statement: "Autenticar wallet para H Love",
          });

          const payload = auth?.finalPayload;

          if (payload?.status === "error") {
            console.warn("[App] WalletAuth error:", JSON.stringify(payload));
          } else if (payload?.address && payload?.message && payload?.signature) {
            console.log("[App] WalletAuth success:", payload.address.slice(0, 10) + "...");
            try {
              const vRes = await fetch("/api/walletVerify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, nonce, userId: nullifierHash }),
              });
              const vData = await vRes.json();
              if (vData.success) {
                setWallet(vData.address);
                console.log("[App] ✅ Wallet set:", vData.address.slice(0, 10) + "...");
              }
            } catch (e) {
              console.warn("[App] walletVerify error:", e);
            }
          }

          const resolvedAddress = wallet || payload?.address || MiniKit.walletAddress;
          if (resolvedAddress && !username) {
            try {
              const wcRes = await fetch(`https://usernames.worldcoin.org/api/v1/${resolvedAddress}`);
              if (wcRes.ok) {
                const wcData = await wcRes.json();
                if (wcData.username) {
                  setUsername(wcData.username);
                  console.log("[App] ✅ Username from Worldcoin:", wcData.username);
                }
              }
            } catch (e) {}
          }

          if (!username && MiniKit.user?.username) {
            setUsername(MiniKit.user.username);
          }
        } catch (err) {
          console.error("[App] Wallet error:", err);
        } finally {
          walletLoading.current = false;
        }
      };

      loadWallet();
    }, [verified, wallet, miniKitReady]);

    const handleVerified = async (uid: string, nullifier: string) => {
      setUserId(uid);
      setNullifierHash(nullifier);
      setVerified(true);
      await loadProfile(uid);
    };

    const handleOnboardingComplete = (newProfile: Profile) => {
      setProfile(newProfile);
      console.log("[App] ✅ Onboarding complete:", newProfile.display_name);
    };

    const handleProfileUpdate = async (updates: Partial<Profile>) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();
      if (!error && data) setProfile(data);
      return { data, error };
    };

    const handleLogout = () => {
      localStorage.removeItem("hlove_user_id");
      localStorage.removeItem("hlove_nullifier");
      setUserId(null);
      setNullifierHash(null);
      setVerified(false);
      setProfile(null);
      setWallet(null);
      setUsername(null);
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

    if (!profile && userId) {
      return <OnboardingPage userId={userId} onComplete={handleOnboardingComplete} />;
    }

    if (!userId || !userRecord || !profile) return null;

    const tabs: { id: Tab; icon: typeof Heart; label: string }[] = [
      { id: "swipe", icon: Flame, label: "Discover" },
      { id: "matches", icon: Heart, label: "Matches" },
      { id: "events", icon: Calendar, label: "Events" },
      { id: "profile", icon: User, label: "Profile" },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "swipe" && <SwipePage userId={userId} isPremium={isPremium} />}
          {activeTab === "matches" && <MatchesPage userId={userId} />}
          {activeTab === "events" && <EventsPage userId={userId} />}
          {activeTab === "profile" && (
            <ProfilePage
              user={userRecord}
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

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    );
  }

  export default App;
  