import { useState, useEffect, useRef } from "react";
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
    const [userId, setUserId] = useState<string | null>(null);
    const [userRecord, setUserRecord] = useState<UserType | null>(null);
    const [verified, setVerified] = useState(false);
    const [wallet, setWallet] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("swipe");
    const [isPremium, setIsPremium] = useState(false);
    const walletLoading = useRef(false);

    useEffect(() => {
      const init = async () => {
        console.log("[App] Init started");
        const storedId = localStorage.getItem("hlove_user_id");
        console.log("[App] storedId from localStorage:", storedId);

        if (storedId) {
          try {
            console.log("[App] Checking stored user with /api/verify?wallet=" + storedId);
            const checkRes = await fetch("/api/verify?wallet=" + storedId);
            console.log("[App] /api/verify GET status:", checkRes.status);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              console.log("[App] /api/verify GET response:", JSON.stringify(checkData));
              if (checkData.valid) {
                setUserId(storedId);
                setVerified(true);
                await loadProfile(storedId);
              } else {
                console.log("[App] Stored user not valid, clearing localStorage");
                localStorage.removeItem("hlove_user_id");
              }
            } else {
              console.log("[App] /api/verify returned non-ok, trying loadProfile anyway");
              setUserId(storedId);
              setVerified(true);
              await loadProfile(storedId);
            }
          } catch (e) {
            console.error("[App] Error checking stored user:", e);
            setUserId(storedId);
            setVerified(true);
            await loadProfile(storedId);
          }
        }

        setLoading(false);
        console.log("[App] Init complete. verified:", !!storedId);
      };

      init();
    }, []);

    const loadProfile = async (uid: string) => {
      console.log("[App] loadProfile called with uid:", uid);
      try {
        console.log("[App] Querying users table by wallet_address...");
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("*")
          .eq("wallet_address", uid)
          .maybeSingle();

        console.log("[App] users query result:", JSON.stringify(userData), "error:", userErr);

        if (!userData) {
          console.log("[App] No user found by wallet_address, trying nullifier_hash...");
          const { data: userData2 } = await supabase
            .from("users")
            .select("*")
            .eq("nullifier_hash", uid)
            .maybeSingle();
          console.log("[App] users query by nullifier_hash:", JSON.stringify(userData2));
          if (userData2) {
            setUserRecord(userData2 as UserType);
            setIsPremium(userData2.is_premium || false);
          }
        } else {
          setUserRecord(userData as UserType);
          setIsPremium(userData.is_premium || false);
        }

        console.log("[App] Querying profiles table by user_id...");
        const { data: profileData, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        console.log("[App] profiles query result:", JSON.stringify(profileData), "error:", profErr);

        if (profileData) {
          setProfile(profileData);
          console.log("[App] Profile loaded:", profileData.display_name);
        } else {
          console.log("[App] No profile found for uid:", uid);
        }
      } catch (err) {
        console.error("[App] Error loading profile:", err);
      }
    };

    useEffect(() => {
      const loadWallet = async () => {
        if (!verified || wallet || !MiniKit.isInstalled() || walletLoading.current) return;
        walletLoading.current = true;
        console.log("[App] loadWallet started");

        try {
          const mkUser = (MiniKit as any).user;
          console.log("[App] MiniKit.user:", JSON.stringify(mkUser));
          if (mkUser) {
            const u = mkUser.username || null;
            if (u) {
              setUsername(u);
              console.log("[App] Username from MiniKit:", u);
            }
          }

          console.log("[App] Fetching nonce...");
          const nonceRes = await fetch("/api/nonce");
          if (!nonceRes.ok) {
            console.error("[App] Failed to get nonce, status:", nonceRes.status);
            throw new Error("No nonce");
          }
          const { nonce } = await nonceRes.json();
          console.log("[App] Got nonce:", nonce);

          console.log("[App] Calling walletAuth...");
          const auth = await MiniKit.commandsAsync.walletAuth({
            nonce,
            requestId: "wallet-auth-" + Date.now(),
            expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            notBefore: new Date(Date.now() - 60 * 1000),
            statement: "Autenticar wallet para H Love",
          });

          const payload = auth?.finalPayload;
          console.log("[App] walletAuth response:", JSON.stringify(payload));

          if (payload?.status === "error") {
            console.warn("[App] WalletAuth error:", JSON.stringify(payload));
          } else if (payload?.address && payload?.message && payload?.signature) {
            console.log("[App] Verifying wallet with backend...");
            const vRes = await fetch("/api/walletVerify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload, nonce, userId }),
            });
            const vData = await vRes.json();
            console.log("[App] walletVerify response:", JSON.stringify(vData));
            if (vData.success) {
              setWallet(vData.address);
            }
          }

          const resolvedAddress = payload?.address || (MiniKit as any).walletAddress;
          console.log("[App] resolvedAddress:", resolvedAddress);
          if (resolvedAddress && !username) {
            try {
              const wcRes = await fetch("https://usernames.worldcoin.org/api/v1/" + resolvedAddress);
              if (wcRes.ok) {
                const wcData = await wcRes.json();
                console.log("[App] WC username lookup:", JSON.stringify(wcData));
                if (wcData.username) {
                  setUsername(wcData.username);
                }
              }
            } catch (e) {
              console.warn("[App] Username lookup failed:", e);
            }
          }
        } catch (err) {
          console.error("[App] Wallet error:", err);
        } finally {
          walletLoading.current = false;
        }
      };

      loadWallet();
    }, [verified, wallet]);

    const handleVerified = async (id: string) => {
      console.log("[App] handleVerified called with id:", id);
      setUserId(id);
      setVerified(true);
      localStorage.setItem("hlove_user_id", id);
      await loadProfile(id);
    };

    const handleOnboardingComplete = (newProfile: Profile) => {
      console.log("[App] Onboarding complete:", newProfile.display_name);
      setProfile(newProfile);
    };

    const handleProfileUpdate = async (updates: Partial<Profile>) => {
      if (!userId) return;
      console.log("[App] Updating profile:", JSON.stringify(updates));
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
      console.log("[App] Logging out");
      localStorage.removeItem("hlove_user_id");
      setUserId(null);
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
      console.log("[App] Rendering LandingPage (not verified)");
      return <LandingPage onVerified={handleVerified} />;
    }

    if (!profile && userId) {
      console.log("[App] Rendering OnboardingPage (no profile, userId:", userId, ")");
      return <OnboardingPage userId={userId} onComplete={handleOnboardingComplete} />;
    }

    if (!userId || !userRecord || !profile) {
      console.log("[App] Rendering null - userId:", userId, "userRecord:", !!userRecord, "profile:", !!profile);
      return null;
    }

    const tabs: { id: Tab; icon: typeof Heart; label: string }[] = [
      { id: "swipe", icon: Flame, label: "Discover" },
      { id: "matches", icon: Heart, label: "Matches" },
      { id: "events", icon: Calendar, label: "Events" },
      { id: "profile", icon: User, label: "Profile" },
    ];

    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0a0a0a", maxWidth: 512, margin: "0 auto" }}>
        <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
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

        <nav style={{ flexShrink: 0, background: "rgba(28,28,30,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0 8px", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 0" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 12px", borderRadius: 12, background: "none", border: "none", color: activeTab === tab.id ? "#ec4899" : "#888", cursor: "pointer", transition: "color 0.2s" }}
              >
                <tab.icon style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
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
  