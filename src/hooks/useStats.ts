import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { UserStats } from "@/types";

export function useStats(userId: string | undefined) {
  return useQuery<UserStats>({
    queryKey: ["stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId)
        return {
          totalSwipes: 0,
          totalMatches: 0,
          totalSuperLikes: 0,
          profileViews: 0,
          matchRate: 0,
        };

      const [swipesRes, matchesRes, superLikesRes] = await Promise.all([
        supabase
          .from("swipes")
          .select("id", { count: "exact", head: true })
          .eq("swiper_id", userId),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
        supabase
          .from("swipes")
          .select("id", { count: "exact", head: true })
          .eq("swiper_id", userId)
          .eq("action", "superlike"),
      ]);

      const totalSwipes = swipesRes.count || 0;
      const totalMatches = matchesRes.count || 0;
      const totalSuperLikes = superLikesRes.count || 0;
      const matchRate =
        totalSwipes > 0 ? Math.round((totalMatches / totalSwipes) * 100) : 0;

      return {
        totalSwipes,
        totalMatches,
        totalSuperLikes,
        profileViews: 0,
        matchRate,
      };
    },
  });
}
