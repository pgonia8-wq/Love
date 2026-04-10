import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VERIFY_ACTION, WORLD_APP_ID } from "@/lib/constants";
import type { User, Profile } from "@/types";

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
        console.log("[Auth] Stored user not found in DB, clearing session", userError);
        localStorage.removeItem("hlove_user_id");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("[Auth] Session restored for user:", user.id, "has profile:", !!profile);

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
    console.log("[Auth] Starting World ID verification...");
    console.log("[Auth] Action:", VERIFY_ACTION);
    console.log("[Auth] App ID:", WORLD_APP_ID);

    try {
      const { MiniKit, VerificationLevel, MiniAppVerifyActionErrorPayload } = await import("@worldcoin/minikit-js");

      console.log("[Auth] MiniKit imported successfully");
      console.log("[Auth] MiniKit.isInstalled():", MiniKit.isInstalled());

      if (!MiniKit.isInstalled()) {
        console.error("[Auth] MiniKit is NOT installed. User must open app inside World App.");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Please open this app inside World App to verify your identity",
        }));
        return false;
      }

      console.log("[Auth] MiniKit is installed, sending verify command...");

      const verifyPayload = {
        action: VERIFY_ACTION,
        verification_level: VerificationLevel.Orb,
      };

      console.log("[Auth] Verify payload:", JSON.stringify(verifyPayload));

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);

      console.log("[Auth] Verify response received:", JSON.stringify(finalPayload));

      if (finalPayload.status === "error") {
        const errorPayload = finalPayload as MiniAppVerifyActionErrorPayload;
        console.error("[Auth] Verification error from World App:", JSON.stringify(errorPayload));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Verification error: ${errorPayload.error_code || "unknown"} - Please try again`,
        }));
        return false;
      }

      console.log("[Auth] Proof received successfully, validating on backend...");
      console.log("[Auth] merkle_root:", finalPayload.merkle_root);
      console.log("[Auth] nullifier_hash:", finalPayload.nullifier_hash);
      console.log("[Auth] verification_level:", finalPayload.verification_level);

      const verifyResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-orb-proof`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            merkle_root: finalPayload.merkle_root,
            nullifier_hash: finalPayload.nullifier_hash,
            proof: finalPayload.proof,
            verification_level: finalPayload.verification_level,
            action: VERIFY_ACTION,
            app_id: WORLD_APP_ID,
          }),
        }
      );

      const data = await verifyResponse.json();

      console.log("[Auth] Backend validation response:", JSON.stringify(data));

      if (!verifyResponse.ok || !data.success) {
        console.error("[Auth] Backend validation failed:", data.error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Verification failed on server. Please try again.",
        }));
        return false;
      }

      console.log("[Auth] User verified! ID:", data.user.id, "isNew:", data.isNewUser);

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
      console.error("[Auth] Verification exception:", err);
      const errorMessage = err instanceof Error ? err.message : "Verification failed";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
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
