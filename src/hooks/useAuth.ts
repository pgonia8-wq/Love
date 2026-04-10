import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VERIFY_ACTION, WORLD_APP_ID } from "@/lib/constants";
import type { User, Profile } from "@/types";
import { MiniKit, type ISuccessResult } from "@worldcoin/minikit-js";

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
        const mkWallet = (MiniKit as any).walletAddress;
        if (mkWallet) {
          localStorage.setItem("hlove_user_id", mkWallet);
          return checkExistingSession();
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

      const verifyPayload = {
        action: VERIFY_ACTION,
        verification_level: "orb" as any,
      };

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);

      if (finalPayload.status === "error") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Verificación cancelada o fallida",
        }));
        return false;
      }

      const successPayload = finalPayload as ISuccessResult;
      const walletAddress = (MiniKit as any).walletAddress || "";

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: successPayload,
          action: VERIFY_ACTION,
          wallet_address: walletAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Error en la verificación",
        }));
        return false;
      }

      const userId = data.wallet_address || walletAddress;
      localStorage.setItem("hlove_user_id", userId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", userId)
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
