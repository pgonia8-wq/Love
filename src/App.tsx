import { useState, useEffect, useRef } from "react";
  import { MiniKit } from "@worldcoin/minikit-js";
  import { Heart, MessageCircle, Calendar, User, Flame } from "lucide-react";
  import LandingPage from "@/pages/LandingPage";
  import OnboardingPage from "@/pages/OnboardingPage";
  import SwipePage from "@/pages/SwipePage";
  import MatchesPage from "@/pages/MatchesPage";
  import ChatPage from "@/pages/ChatPage";
  import EventsPage from "@/pages/EventsPage";
  import ProfilePage from "@/pages/ProfilePage";
  import { supabase } from "@/lib/supabase";
  import type { Profile } from "@/types";

  type Tab = "swipe" | "matches" | "chat" | "events" | "profile";

  function App() {
    const [userId, setUserId] = useState<string | null>(null);
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

        if (storedId) {
          try {
            const checkRes = await fetch(`/api/verify?userId=${storedId}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.valid) {
                setUserId(storedId);
                setVerified(true);
                await loadProfile(storedId);
              } else {
                localStorage.removeItem("hlove_user_id");
              }
            } else {
              setUserId(storedId);
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
          .select("is_premium")
          .eq("nullifier_hash", uid)
          .maybeSingle();

        if (userData) {
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
        }
      } catch (err) {
        console.warn("[App] Error loading profile:", err);
      }
    };

    useEffect(() => {
      const loadWallet = async () => {
        if (!verified || wallet || !MiniKit.isInstalled() || walletLoading.current) return;
        walletLoading.current = true;

        try {
          if (MiniKit.user) {
            const u = MiniKit.user.username || null;
            if (u) {
              setUsername(u);
              console.log("[App] Username from MiniKit:", u);
            }
          }

          const nonceRes = await fetch("/api/nonce");
          if (!nonceRes.ok) throw new Error("No nonce");
          const { nonce } = await nonceRes.json();

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
            const vRes = await fetch("/api/walletVerify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload, nonce, userId }),
            });
            const vData = await vRes.json();
            if (vData.success) {
              setWallet(vData.address);
              console.log("[App] Wallet:", vData.address.slice(0, 10) + "...");
            }
          }

          const resolvedAddress = payload?.address || MiniKit.walletAddress;
          if (resolvedAddress && !username) {
            try {
              const wcRes = await fetch(`https://usernames.worldcoin.org/api/v1/${resolvedAddress}`);
              if (wcRes.ok) {
                const wcData = await wcRes.json();
                if (wcData.username) {
                  setUsername(wcData.username);
                  console.log("[App] Username from Worldcoin API:", wcData.username);
                }
              }
            } catch (e) {
              console.warn("[App] Username API error:", e);
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
      setUserId(id);
      setVerified(true);
      await loadProfile(id);
    };

    const handleOnboardingComplete = (newProfile: Profile) => {
      setProfile(newProfile);
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

    if (!userId) return null;

    const tabs: { id: Tab; icon: typeof Heart; label: string }[] = [
      { id: "swipe", icon: Flame, label: "Discover" },
      { id: "matches", icon: Heart, label: "Matches" },
      { id: "chat", icon: MessageCircle, label: "Chat" },
      { id: "events", icon: Calendar, label: "Events" },
      { id: "profile", icon: User, label: "Profile" },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "swipe" && <SwipePage userId={userId} isPremium={isPremium} />}
          {activeTab === "matches" && <MatchesPage userId={userId} />}
          {activeTab === "chat" && <ChatPage userId={userId} />}
          {activeTab === "events" && <EventsPage userId={userId} isPremium={isPremium} />}
          {activeTab === "profile" && (
            <ProfilePage
              userId={userId}
              profile={profile!}
              username={username}
              wallet={wallet}
              isPremium={isPremium}
            />
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 px-2 pb-safe">
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

  export default App;
  