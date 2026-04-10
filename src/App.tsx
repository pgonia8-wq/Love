import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Users, Calendar, User, Crown } from "lucide-react";
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
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
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
    <div className="flex items-center justify-around py-2 px-2 border-t border-border/30 bg-card/50 backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = activePath === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => setLocation(tab.path)}
            className="relative flex flex-col items-center gap-0.5 py-1.5 px-3"
          >
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -top-0.5 w-8 h-0.5 gradient-love rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <tab.icon
              className={`w-5 h-5 transition-colors ${
                isActive ? "text-love-pink" : "text-muted-foreground"
              }`}
              fill={isActive && tab.icon === Heart ? "currentColor" : "none"}
            />
            <span
              className={`text-[10px] transition-colors ${
                isActive ? "text-love-pink font-medium" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </span>
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

  const loadSession = useCallback(async (userId: string) => {
    console.log("[App] Loading session for userId:", userId);
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!userData) {
      console.log("[App] User not found, clearing session");
      localStorage.removeItem("hlove_user_id");
      setIsLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    console.log("[App] Session loaded. user:", userData.id, "profile:", !!profileData);
    setUser(userData);
    setProfile(profileData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const storedUserId = localStorage.getItem("hlove_user_id");
    if (storedUserId) {
      loadSession(storedUserId);
    } else {
      setIsLoading(false);
    }
  }, [loadSession]);

  const handleVerified = (userId: string) => {
    loadSession(userId);
  };

  const handleProfileUpdate = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
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

  const showNav =
    user && profile && !location.startsWith("/chat/") && !location.startsWith("/onboarding");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl gradient-love flex items-center justify-center mb-4 animate-pulse-glow">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </div>
          <div className="w-8 h-8 border-2 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onVerified={handleVerified} />;
  }

  if (!profile) {
    return (
      <OnboardingPage
        userId={user.id}
        onComplete={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col max-w-lg mx-auto overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Switch>
          <Route path="/">
            <SwipePage userId={user.id} isPremium={user.is_premium} />
          </Route>
          <Route path="/matches">
            <MatchesPage userId={user.id} />
          </Route>
          <Route path="/chat/:matchId">
            <ChatPage userId={user.id} />
          </Route>
          <Route path="/events">
            <EventsPage userId={user.id} />
          </Route>
          <Route path="/wallet">
            <WalletPage user={user} userId={user.id} />
          </Route>
          <Route path="/profile">
            <ProfilePage
              user={user}
              profile={profile}
              onUpdate={handleProfileUpdate}
              onLogout={handleLogout}
            />
          </Route>
          <Route>
            <SwipePage userId={user.id} isPremium={user.is_premium} />
          </Route>
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
