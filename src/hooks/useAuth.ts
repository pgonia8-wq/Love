import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VERIFY_ACTION, WORLD_APP_ID } from "@/lib/constants";
import type { User, Profile } from "@/types";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";

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
        console.log("[Auth] No stored session found");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      console.log("[Auth] Found stored userId:", storedUserId);

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", storedUserId)
        .single();

      if (userError || !user) {
        console.log("[Auth] Stored user not found in DB, clearing", userError);
        localStorage.removeItem("hlove_user_id");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("[Auth] Session restored for user:", user.id, "profile:", !!profile);

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

    console.log("[Auth] === Starting World ID Verification ===");
    console.log("[Auth] VERIFY_ACTION:", VERIFY_ACTION);
    console.log("[Auth] WORLD_APP_ID:", WORLD_APP_ID);
    console.log("[Auth] MiniKit.isInstalled():", MiniKit.isInstalled());
    console.log("[Auth] MiniKit.walletAddress:", MiniKit.walletAddress);
    console.log("[Auth] VerificationLevel.Orb:", VerificationLevel.Orb);

    try {
      if (!MiniKit.isInstalled()) {
        console.error("[Auth] MiniKit NOT installed - not inside World App");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Abre esta app dentro de World App para verificarte",
        }));
        return false;
      }

      const verifyPayload = {
        action: VERIFY_ACTION,
        verification_level: VerificationLevel.Orb,
      };

      console.log("[Auth] Calling MiniKit.commandsAsync.verify with:", JSON.stringify(verifyPayload));

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);

      console.log("[Auth] Got finalPayload:", JSON.stringify(finalPayload));

      if (finalPayload.status === "error") {
        console.error("[Auth] World App returned error:", JSON.stringify(finalPayload));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Error de verificación: ${(finalPayload as any).error_code || "desconocido"}`,
        }));
        return false;
      }

      console.log("[Auth] Proof received! Sending to backend...");
      console.log("[Auth] merkle_root:", (finalPayload as any).merkle_root);
      console.log("[Auth] nullifier_hash:", (finalPayload as any).nullifier_hash);
      console.log("[Auth] verification_level:", (finalPayload as any).verification_level);

      const backendUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-orb-proof`;
      console.log("[Auth] Backend URL:", backendUrl);

      const verifyResponse = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          merkle_root: (finalPayload as any).merkle_root,
          nullifier_hash: (finalPayload as any).nullifier_hash,
          proof: (finalPayload as any).proof,
          verification_level: (finalPayload as any).verification_level,
          action: VERIFY_ACTION,
          app_id: WORLD_APP_ID,
        }),
      });

      const data = await verifyResponse.json();
      console.log("[Auth] Backend response status:", verifyResponse.status);
      console.log("[Auth] Backend response:", JSON.stringify(data));

      if (!verifyResponse.ok || !data.success) {
        console.error("[Auth] Backend validation failed:", data.error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Fallo en la verificación del servidor",
        }));
        return false;
      }

      console.log("[Auth] Verified! User ID:", data.user.id, "isNew:", data.isNewUser);

      localStorage.setItem("hlove_user_id", data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      console.log("[Auth] Profile loaded:", !!profile);

      setState({
        user: data.user,
        profile,
        isLoading: false,
        isVerified: true,
        error: null,
      });

      return true;
    } catch (err) {
      console.error("[Auth] Exception during verification:", err);
      console.error("[Auth] Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err as any)));
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
            user_id: state.user.id,
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
    console.log("[Auth] Logging out");
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
