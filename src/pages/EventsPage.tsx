import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Ticket, Clock, Sparkles } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { usePayments } from "@/hooks/usePayments";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Event } from "@/types";

interface EventsPageProps {
  userId: string;
}

const TYPE_LABELS: Record<string, string> = {
  speed_dating: "Speed Dating",
  networking: "Networking",
  meetup: "Meetup",
  workshop: "Workshop",
};

const TYPE_COLORS: Record<string, string> = {
  speed_dating: "from-love-pink to-love-rose",
  networking: "from-love-purple to-love-pink",
  meetup: "from-love-gold to-love-pink",
  workshop: "from-blue-500 to-love-purple",
};

export default function EventsPage({ userId }: EventsPageProps) {
  const { events, isLoading, hasTicket, purchaseTicket } = useEvents(userId);
  const { initiatePayment } = usePayments(userId);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (event: Event, currency: "WLD" | "USDC") => {
    setPurchasing(event.id);
    try {
      const amount = currency === "WLD" ? event.ticket_price_wld : event.ticket_price_usdc;
      await initiatePayment("event_ticket", currency, event.id);
    } catch (err) {
    } finally {
      setPurchasing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-4 overflow-auto">
      <h2 className="text-2xl font-bold gradient-love-text mb-1">Events</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Meet verified humans in person
      </p>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h4 className="font-semibold mb-1">No upcoming events</h4>
          <p className="text-sm text-muted-foreground">Check back soon for new events</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-2xl overflow-hidden"
            >
              {event.cover_image && (
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={event.cover_image}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span
                      className={`text-[10px] font-semibold text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${
                        TYPE_COLORS[event.event_type] || TYPE_COLORS.meetup
                      }`}
                    >
                      {TYPE_LABELS[event.event_type] || event.event_type}
                    </span>
                  </div>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {event.description}
                </p>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-foreground/70">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(event.event_date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground/70">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.location}, {event.city}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground/70">
                    <Users className="w-3.5 h-3.5" />
                    {event.current_attendees}/{event.max_attendees} attending
                  </div>
                </div>

                {hasTicket(event.id) ? (
                  <div className="flex items-center gap-2 text-love-pink">
                    <Ticket className="w-4 h-4" />
                    <span className="text-sm font-medium">You have a ticket</span>
                  </div>
                ) : event.current_attendees >= event.max_attendees ? (
                  <p className="text-sm text-muted-foreground font-medium">Sold Out</p>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePurchase(event, "WLD")}
                      disabled={purchasing === event.id}
                      className="flex-1 gradient-love border-0 text-xs h-9 rounded-xl"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {event.ticket_price_wld} WLD
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePurchase(event, "USDC")}
                      disabled={purchasing === event.id}
                      className="flex-1 text-xs h-9 rounded-xl"
                    >
                      ${event.ticket_price_usdc} USDC
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
