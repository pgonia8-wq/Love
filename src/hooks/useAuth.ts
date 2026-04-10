import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VERIFY_ACTION } from "@/lib/constants";
import type { User, Profile } from "@/types";
import { MiniKit, type ISuccessResult, VerificationLevel } from "@worldcoin/minikit-js";

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
      console.log("[useAuth] checkExistingSession, storedUserId:", storedUserId);

      if (!storedUserId) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .or(`wallet_address.eq.${storedUserId},nullifier_hash.eq.${storedUserId}`)
        .maybeSingle();

      console.log("[useAuth] user lookup result:", !!user, "error:", userError?.message);

      if (userError || !user) {
        console.log("[useAuth] No user found, clearing session");
        localStorage.removeItem("hlove_user_id");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", storedUserId)
        .maybeSingle();

      console.log("[useAuth] profile loaded:", !!profile);

      setState({
        user,
        profile,
        isLoading: false,
        isVerified: user.is_verified,
        error: null,
      });
    } catch (err) {
      console.error("[useAuth] Session check error:", err);
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
        console.error("[useAuth] MiniKit not installed");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Abre esta app dentro de World App para verificarte",
        }));
        return false;
      }

      console.log("[useAuth] Calling MiniKit.commandsAsync.verify with action:", VERIFY_ACTION);
      const verifyPayload = {
        action: VERIFY_ACTION,
        verification_level: VerificationLevel.Orb,
      };

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);
      console.log("[useAuth] verify result status:", finalPayload?.status);

      if (finalPayload.status === "error") {
        console.error("[useAuth] Verification failed:", JSON.stringify(finalPayload));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Verificacion cancelada o fallida",
        }));
        return false;
      }

      const successPayload = finalPayload as ISuccessResult;
      const walletAddress = (MiniKit as any).walletAddress || "";
      const nullifierHash = successPayload.nullifier_hash;
      console.log("[useAuth] nullifier_hash:", nullifierHash);
      console.log("[useAuth] walletAddress:", walletAddress);

      console.log("[useAuth] Sending proof to backend /api/verify...");
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: successPayload,
          action: VERIFY_ACTION,
          wallet_address: walletAddress,
          username: (MiniKit as any).user?.username || "",
        }),
      });

      const data = await res.json();
      console.log("[useAuth] /api/verify response:", JSON.stringify(data));

      if (!res.ok || !data.success) {
        console.error("[useAuth] Backend rejected:", data.error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Error en la verificacion",
        }));
        return false;
      }

      const userId = data.nullifier_hash || data.wallet_address || walletAddress;
      console.log("[useAuth] Verification SUCCESS, userId:", userId);
      localStorage.setItem("hlove_user_id", userId);

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .or(`wallet_address.eq.${userId},nullifier_hash.eq.${userId}`)
        .maybeSingle();

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("[useAuth] Post-verify user:", !!user, "profile:", !!profile);

      setState({
        user: user || null,
        profile,
        isLoading: false,
        isVerified: true,
        error: null,
      });

      return true;
    } catch (err) {
      console.error("[useAuth] Exception:", err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Error de verificacion",
      }));
      return false;
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!state.user) return;

      const userId = state.user.nullifier_hash || state.user.wallet_address;
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
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
    console.log("[useAuth] Logging out");
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
