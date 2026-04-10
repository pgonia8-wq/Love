import { useState, useEffect } from "react";
  import { motion } from "framer-motion";
  import { Calendar, MapPin, Users, Ticket, Clock, Crown, Sparkles } from "lucide-react";
  import { useI18n } from "@/lib/i18n";
  import { supabase } from "@/lib/supabase";
  import { Button } from "@/components/ui/button";

  interface Event {
    id: string;
    title: string;
    description: string;
    event_date: string;
    location: string;
    image_url?: string;
    max_attendees: number;
    current_attendees: number;
    price_usdc?: number;
    price_wld?: number;
    is_premium_only: boolean;
    category?: string;
  }

  interface EventsPageProps {
    userId: string;
  }

  const MOCK_EVENTS: Event[] = [
    {
      id: "evt_1",
      title: "Rooftop Sunset Mixer",
      description: "Meet verified singles while enjoying the best sunset views in the city. Craft cocktails, live DJ, and guaranteed connections.",
      event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      location: "Sky Lounge, Mexico City",
      image_url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=300&fit=crop",
      max_attendees: 60,
      current_attendees: 43,
      price_usdc: 15,
      price_wld: 5,
      is_premium_only: false,
      category: "Social",
    },
    {
      id: "evt_2",
      title: "Speed Dating Night",
      description: "8 minutes per connection. All attendees are Orb-verified. Premium members get priority matching.",
      event_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      location: "Casa Bonita, Bogota",
      image_url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=300&fit=crop",
      max_attendees: 40,
      current_attendees: 37,
      price_usdc: 20,
      price_wld: 7,
      is_premium_only: false,
      category: "Dating",
    },
    {
      id: "evt_3",
      title: "VIP Wine & Connect",
      description: "An exclusive evening for Premium members. Curated wine tasting with a sommelier and intimate conversations.",
      event_date: new Date(Date.now() + 21 * 86400000).toISOString(),
      location: "Vinoteca Privada, Madrid",
      image_url: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=300&fit=crop",
      max_attendees: 24,
      current_attendees: 19,
      price_usdc: 35,
      price_wld: 12,
      is_premium_only: true,
      category: "Premium",
    },
    {
      id: "evt_4",
      title: "Beach Volleyball Tournament",
      description: "Mixed teams, casual competition, and post-game drinks. Meet active people who love the outdoors.",
      event_date: new Date(Date.now() + 10 * 86400000).toISOString(),
      location: "Playa del Carmen",
      image_url: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&h=300&fit=crop",
      max_attendees: 32,
      current_attendees: 28,
      price_usdc: 10,
      price_wld: 3.5,
      is_premium_only: false,
      category: "Sports",
    },
  ];

  export default function EventsPage({ userId }: EventsPageProps) {
    const { t } = useI18n();
    const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
    const [myTickets, setMyTickets] = useState<string[]>([]);

    useEffect(() => {
      const loadEvents = async () => {
        const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });
        if (data && data.length > 0) setEvents(data);
        const { data: tickets } = await supabase.from("event_tickets").select("event_id").eq("user_id", userId);
        if (tickets) setMyTickets(tickets.map((t: any) => t.event_id));
      };
      loadEvents();
    }, [userId]);

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    };
    const formatTime = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    };

    return (
      <div className="flex flex-col pt-4 px-4 pb-24">
        <div className="mb-5 pt-2">
          <h2 className="text-2xl font-bold">{t("events.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("events.subtitle")}</p>
        </div>

        <div className="space-y-4">
          {events.map((event, i) => {
            const isFull = event.current_attendees >= event.max_attendees;
            const hasTicket = myTickets.includes(event.id);
            const fillPct = (event.current_attendees / event.max_attendees) * 100;

            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-card rounded-2xl overflow-hidden border border-border/30 shadow-sm">
                <div className="relative h-36">
                  <img src={event.image_url || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=300&fit=crop"} alt={event.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {event.is_premium_only && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-love-gold/90 px-2 py-1 rounded-full">
                      <Crown className="w-3 h-3 text-white" /><span className="text-[10px] font-bold text-white">VIP</span>
                    </div>
                  )}
                  {event.category && (
                    <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
                      <span className="text-[10px] font-medium text-white">{event.category}</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <h3 className="text-white font-bold text-lg leading-tight">{event.title}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{event.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.event_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(event.event_date)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fillPct > 80 ? "bg-destructive" : "bg-love-pink"}`} style={{ width: fillPct + "%" }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Users className="w-3 h-3" />{event.current_attendees}/{event.max_attendees}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {event.price_usdc && <span className="text-sm font-bold">{event.price_usdc} USDC</span>}
                      {event.price_wld && <span className="text-xs text-muted-foreground">/ {event.price_wld} WLD</span>}
                    </div>
                    {hasTicket ? (
                      <div className="flex items-center gap-1 text-green-500 text-sm font-medium"><Ticket className="w-4 h-4" />{t("events.youHaveTicket")}</div>
                    ) : isFull ? (
                      <span className="text-xs font-medium text-destructive">{t("events.soldOut")}</span>
                    ) : (
                      <Button size="sm" className="gradient-love border-0 rounded-xl text-xs h-8 px-4">
                        <Ticket className="w-3 h-3 mr-1" />Get Ticket
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }
  