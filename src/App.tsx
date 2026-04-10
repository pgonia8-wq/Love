import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Users, Calendar, User, Crown } from "lucide-react";
import { MiniKit } from "@worldcoin/minikit-js";
import { supabase } from "@/lib/supabase";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SwipePage from "@/pages/SwipePage";
import MatchesPage from "@/pages/MatchesPage";
import ChatPage from "@/pages/ChatPage";
import EventsPage from "@/pages/EventsPage";
import ProfilePage from "@/pages/ProfilePage";
import WalletPage from "@/pages/WalletPage";
import type { User as UserType, Profile } from "@/types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function NavBar() {
  const [location, setLocation] = useLocation();
  const tabs = [
    { path: "/", icon: Heart, label: "Discover" },
    { path: "/matches", icon: Users, label: "Matches" },
    { path: "/events", icon: Calendar, label: "Events" },
    { path: "/wallet", icon: Crown, label: "Premium" },
    { path: "/profile", icon: User, label: "Profile" },
  ];
  const activePath = location === "/" ? "/" : "/" + location.split("/")[1];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(16px)", flexShrink: 0 }}>
      {tabs.map((tab) => {
        const isActive = activePath === tab.path;
        return (
          <button key={tab.path} onClick={() => setLocation(tab.path)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 12px", background: "none", border: "none", position: "relative" }}>
            {isActive && (
              <motion.div layoutId="nav-indicator"
                style={{ position: "absolute", top: -2, width: 32, height: 2, borderRadius: 1, background: "linear-gradient(90deg, #ec4899, #a855f7)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <tab.icon style={{ width: 20, height: 20, color: isActive ? "#ec4899" : "#888" }}
              fill={isActive && tab.icon === Heart ? "currentColor" : "none"} />
            <span style={{ fontSize: 10, color: isActive ? "#ec4899" : "#888", fontWeight: isActive ? 500 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [location] = useLocation();

  const loadSession = useCallback(async (walletAddress: string) => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (!userData) {
        setIsLoading(false);
        return false;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", walletAddress)
        .maybeSingle();

      setUser(userData);
      setProfile(profileData);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[App] Session load error:", err);
      setIsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("hlove_user_id");
      if (stored) {
        const found = await loadSession(stored);
        if (found) return;
      }

      if (MiniKit.isInstalled()) {
        const mkWallet = MiniKit.user?.walletAddress;
        if (mkWallet) {
          localStorage.setItem("hlove_user_id", mkWallet);
          const found = await loadSession(mkWallet);
          if (found) return;
        }
      }

      setIsLoading(false);
    };
    init();
  }, [loadSession]);

  const handleVerified = (walletAddress: string) => {
    localStorage.setItem("hlove_user_id", walletAddress);
    loadSession(walletAddress);
  };

  const handleProfileUpdate = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.wallet_address, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
      .select()
      .single();
    if (!error && data) setProfile(data);
    return { data, error };
  };

  const handleLogout = () => {
    localStorage.removeItem("hlove_user_id");
    setUser(null);
    setProfile(null);
  };

  const showNav = user && profile && !location.startsWith("/chat/") && !location.startsWith("/onboarding");

  if (isLoading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="gradient-love animate-pulse-glow"
            style={{ width: 64, height: 64, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Heart style={{ width: 32, height: 32, color: "#fff" }} fill="white" />
          </div>
          <div style={{ width: 32, height: 32, border: "2px solid rgba(236,72,153,0.3)", borderTop: "2px solid #ec4899", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onVerified={handleVerified} />;
  }

  if (!profile) {
    return <OnboardingPage userId={user.wallet_address} onComplete={() => window.location.reload()} />;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", maxWidth: 512, margin: "0 auto", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Switch>
          <Route path="/"><SwipePage userId={user.wallet_address} isPremium={user.is_premium} /></Route>
          <Route path="/matches"><MatchesPage userId={user.wallet_address} /></Route>
          <Route path="/chat/:matchId"><ChatPage userId={user.wallet_address} /></Route>
          <Route path="/events"><EventsPage userId={user.wallet_address} /></Route>
          <Route path="/wallet"><WalletPage user={user} userId={user.wallet_address} /></Route>
          <Route path="/profile"><ProfilePage user={user} profile={profile} onUpdate={handleProfileUpdate} onLogout={handleLogout} /></Route>
          <Route><SwipePage userId={user.wallet_address} isPremium={user.is_premium} /></Route>
        </Switch>
      </div>
      {showNav && <NavBar />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppContent />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
