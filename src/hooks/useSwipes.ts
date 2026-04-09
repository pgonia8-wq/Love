import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { SwipeProfile } from "@/types";

export function useSwipes(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [undoStack, setUndoStack] = useState<string[]>([]);

  const {
    data: feed = [],
    isLoading,
    refetch,
  } = useQuery<SwipeProfile[]>({
    queryKey: ["swipe-feed", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data: swipedIds } = await supabase
        .from("swipes")
        .select("swiped_id")
        .eq("swiper_id", userId);

      const excludeIds = [
        userId,
        ...(swipedIds?.map((s) => s.swiped_id) || []),
      ];

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("interests, location_lat, location_lng")
        .eq("user_id", userId)
        .single();

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .gte("age", 18)
        .order("last_active_at", { ascending: false })
        .limit(20);

      if (error || !profiles) return [];

      return profiles.map((p) => {
        let score = 0;
        if (myProfile?.interests && p.interests) {
          const myInterests = new Set(myProfile.interests);
          const shared = p.interests.filter((i: string) => myInterests.has(i));
          score = Math.round((shared.length / Math.max(myInterests.size, 1)) * 100);
        }
        return { ...p, compatibility_score: score };
      }).sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));
    },
  });

  const swipeMutation = useMutation({
    mutationFn: async ({
      swipedId,
      action,
    }: {
      swipedId: string;
      action: "like" | "pass" | "superlike";
    }) => {
      const { error } = await supabase.from("swipes").insert({
        swiper_id: userId,
        swiped_id: swipedId,
        action,
      });

      if (error) throw error;

      if (action === "like" || action === "superlike") {
        const { data: reciprocal } = await supabase
          .from("swipes")
          .select("id")
          .eq("swiper_id", swipedId)
          .eq("swiped_id", userId)
          .in("action", ["like", "superlike"])
          .single();

        if (reciprocal) {
          const { data: match } = await supabase
            .from("matches")
            .insert({
              user1_id: userId! < swipedId ? userId : swipedId,
              user2_id: userId! < swipedId ? swipedId : userId,
            })
            .select()
            .single();

          return { matched: true, match };
        }
      }

      return { matched: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swipe-feed", userId] });
      queryClient.invalidateQueries({ queryKey: ["matches", userId] });
    },
  });

  const handleSwipe = useCallback(
    async (swipedId: string, action: "like" | "pass" | "superlike") => {
      if (action !== "pass") {
        setUndoStack((prev) => [...prev, swipedId]);
      }
      return swipeMutation.mutateAsync({ swipedId, action });
    },
    [swipeMutation]
  );

  const handleUndo = useCallback(
    async (isPremium: boolean) => {
      if (!isPremium || undoStack.length === 0) return;

      const lastSwipedId = undoStack[undoStack.length - 1];
      await supabase
        .from("swipes")
        .delete()
        .eq("swiper_id", userId)
        .eq("swiped_id", lastSwipedId);

      setUndoStack((prev) => prev.slice(0, -1));
      queryClient.invalidateQueries({ queryKey: ["swipe-feed", userId] });
    },
    [userId, undoStack, queryClient]
  );

  return {
    feed,
    isLoading,
    refetch,
    handleSwipe,
    handleUndo,
    canUndo: undoStack.length > 0,
    isProcessing: swipeMutation.isPending,
  };
}
