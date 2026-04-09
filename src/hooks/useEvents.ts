import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Event, EventTicket } from "@/types";

export function useEvents(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });

      if (error) return [];
      return data || [];
    },
  });

  const { data: myTickets = [] } = useQuery<EventTicket[]>({
    queryKey: ["my-tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("user_id", userId);

      if (error) return [];
      return data || [];
    },
  });

  const purchaseTicket = async (
    eventId: string,
    currency: "WLD" | "USDC",
    amount: number,
    txId: string
  ) => {
    const { data, error } = await supabase.functions.invoke("confirm-payment", {
      body: {
        user_id: userId,
        payment_type: "event_ticket",
        currency,
        amount,
        tx_id: txId,
        event_id: eventId,
      },
    });

    if (!error && data?.success) {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets", userId] });
    }

    return { data, error };
  };

  const hasTicket = (eventId: string) =>
    myTickets.some((t) => t.event_id === eventId);

  return { events, myTickets, isLoading, purchaseTicket, hasTicket };
}
