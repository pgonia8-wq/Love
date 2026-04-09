import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VERIFY_ACTION, WORLD_APP_ID } from "@/lib/constants";
import type { User, Profile } from "@/types";

interface MiniKitVerifyPayload {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: string;
}

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
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", storedUserId)
        .single();

      if (userError || !user) {
        localStorage.removeItem("hlove_user_id");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setState({
        user,
        profile,
        isLoading: false,
        isVerified: user.is_verified,
        error: null,
      });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const verifyWithWorldId = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const MiniKit = (await import("@worldcoin/minikit-js")).MiniKit;

      if (!MiniKit.isInstalled()) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Please open this app inside World App",
        }));
        return false;
      }

      const verifyPayload = {
        action: VERIFY_ACTION,
        verification_level: "orb",
      };

      const minikit = await import("@worldcoin/minikit-js");
      const result = await minikit.MiniKit.commandsAsync.verify(verifyPayload);

      if (!result || !result.finalPayload) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Verification was cancelled",
        }));
        return false;
      }

      const payload = result.finalPayload as unknown as MiniKitVerifyPayload;

      const { data, error } = await supabase.functions.invoke(
        "validate-orb-proof",
        {
          body: {
            merkle_root: payload.merkle_root,
            nullifier_hash: payload.nullifier_hash,
            proof: payload.proof,
            verification_level: payload.verification_level,
            action: VERIFY_ACTION,
            app_id: WORLD_APP_ID,
          },
        }
      );

      if (error || !data?.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data?.error || "Verification failed. Please try again.",
        }));
        return false;
      }

      localStorage.setItem("hlove_user_id", data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      setState({
        user: data.user,
        profile,
        isLoading: false,
        isVerified: true,
        error: null,
      });

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Verification failed",
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
