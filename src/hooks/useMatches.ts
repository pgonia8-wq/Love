import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { MatchWithProfile } from "@/types";

export function useMatches(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading } = useQuery<MatchWithProfile[]>({
    queryKey: ["matches", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("is_active", true)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error || !data) return [];

      const otherUserIds = data.map((m) =>
        m.user1_id === userId ? m.user2_id : m.user1_id
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", otherUserIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return data.map((m) => ({
        ...m,
        profile:
          profileMap.get(
            m.user1_id === userId ? m.user2_id : m.user1_id
          ) || ({} as any),
      }));
    },
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("matches-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["matches", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { matches, isLoading };
}
