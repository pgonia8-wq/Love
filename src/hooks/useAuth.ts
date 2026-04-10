import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Profile } from "@/types";
import { MiniKit } from "@worldcoin/minikit-js";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isVerified: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isVerified: false,
    error: null,
  });

  const checkExistingSession = useCallback(async () => {
    try {
      const storedUserId = localStorage.getItem("hlove_user_id");
      if (!storedUserId) {
        if (MiniKit.isInstalled()) {
          const mkWallet = MiniKit.user?.walletAddress;
          if (mkWallet) {
            localStorage.setItem("hlove_user_id", mkWallet);
            return checkExistingSession();
          }
        }
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", storedUserId)
        .maybeSingle();

      if (userError || !user) {
        localStorage.removeItem("hlove_user_id");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", storedUserId)
        .maybeSingle();

      setState({
        user,
        profile,
        isLoading: false,
        isVerified: user.is_verified,
        error: null,
      });
    } catch (err) {
      console.error("[Auth] Session check error:", err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const verifyWithWorldId = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!MiniKit.isInstalled()) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Abre esta app dentro de World App para verificarte",
        }));
        return false;
      }

      const isOrbVerified = MiniKit.user?.verificationStatus?.isOrbVerified;
      if (!isOrbVerified) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Se requiere verificación Orb. Verifica tu identidad en World App.",
        }));
        return false;
      }

      const nonceRes = await fetch("/api/nonce");
      const { nonce } = await nonceRes.json();

      const result = await MiniKit.walletAuth({
        nonce,
        statement: "Iniciar sesión en H Love",
        expirationTime: new Date(Date.now() + 1000 * 60 * 60),
      });

      if (result.executedWith === "fallback") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Autenticación cancelada",
        }));
        return false;
      }

      const { address, message, signature } = result.data;

      const verifyResponse = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: address,
          message,
          signature,
          nonce,
          username: MiniKit.user?.username || "",
          is_orb_verified: true,
        }),
      });

      const data = await verifyResponse.json();

      if (!verifyResponse.ok || !data.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Error en la verificación",
        }));
        return false;
      }

      localStorage.setItem("hlove_user_id", address);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", address)
        .maybeSingle();

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", address)
        .single();

      setState({
        user: user || null,
        profile,
        isLoading: false,
        isVerified: true,
        error: null,
      });

      return true;
    } catch (err) {
      console.error("[Auth] Exception:", err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Error de verificación",
      }));
      return false;
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!state.user) return;

      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: state.user.wallet_address,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (!error && data) {
        setState((prev) => ({ ...prev, profile: data }));
      }

      return { data, error };
    },
    [state.user]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("hlove_user_id");
    setState({
      user: null,
      profile: null,
      isLoading: false,
      isVerified: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    verifyWithWorldId,
    updateProfile,
    logout,
    refetch: checkExistingSession,
  };
}
