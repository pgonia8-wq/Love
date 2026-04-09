import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";

export function useChat(matchId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["messages", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      if (!matchId) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) return [];
      return data || [];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: userId,
        content,
      });

      if (error) throw error;

      await supabase
        .from("matches")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", matchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches", userId] });
    },
  });

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  useEffect(() => {
    if (!matchId || !userId) return;

    supabase
      .from("messages")
      .update({ is_read: true })
      .eq("match_id", matchId)
      .neq("sender_id", userId)
      .eq("is_read", false)
      .then();
  }, [matchId, userId, messages]);

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
  };
}
