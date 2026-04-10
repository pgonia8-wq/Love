import { useState, useEffect } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Heart, MessageCircle, Shield, Search, ArrowLeft, Send } from "lucide-react";
  import { useI18n } from "@/lib/i18n";
  import { supabase } from "@/lib/supabase";
  import { Button } from "@/components/ui/button";

  interface MatchUser {
    id: string;
    display_name: string;
    photos: string[];
    age: number;
    city?: string;
    bio?: string;
    matched_at: string;
    last_message?: string;
    unread?: boolean;
  }

  interface MatchesPageProps {
    userId: string;
  }

  export default function MatchesPage({ userId }: MatchesPageProps) {
    const { t } = useI18n();
    const [matches, setMatches] = useState<MatchUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatWith, setChatWith] = useState<MatchUser | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMsg, setNewMsg] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
      loadMatches();
    }, [userId]);

    const loadMatches = async () => {
      try {
        const { data: matchRows } = await supabase
          .from("matches")
          .select("*")
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (!matchRows || matchRows.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        const otherIds = matchRows.map((m: any) => m.user1_id === userId ? m.user2_id : m.user1_id);
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", otherIds);

        const mapped = matchRows.map((m: any) => {
          const otherId = m.user1_id === userId ? m.user2_id : m.user1_id;
          const profile = profiles?.find((p: any) => p.user_id === otherId);
          return {
            id: otherId,
            display_name: profile?.display_name || "Unknown",
            photos: profile?.photos || [],
            age: profile?.age || 0,
            city: profile?.city,
            bio: profile?.bio,
            matched_at: m.created_at,
          };
        });

        setMatches(mapped);
      } catch (err) {
        console.error("Load matches error:", err);
      }
      setLoading(false);
    };

    const openChat = async (match: MatchUser) => {
      setChatWith(match);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${match.id}),and(sender_id.eq.${match.id},receiver_id.eq.${userId})`)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    };

    const sendMessage = async () => {
      if (!newMsg.trim() || !chatWith || sending) return;
      setSending(true);
      const msg = { sender_id: userId, receiver_id: chatWith.id, content: newMsg.trim(), read: false };
      const { data, error } = await supabase.from("messages").insert(msg).select().single();
      if (!error && data) setMessages(prev => [...prev, data]);
      setNewMsg("");
      setSending(false);
    };

    if (chatWith) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-lg">
            <button onClick={() => setChatWith(null)}><ArrowLeft className="w-5 h-5" /></button>
            <img src={chatWith.photos?.[0] || "/placeholder.jpg"} alt="" className="w-9 h-9 rounded-full object-cover" />
            <div className="flex-1"><h4 className="font-semibold text-sm">{chatWith.display_name}</h4><p className="text-[10px] text-muted-foreground">Online</p></div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Heart className="w-10 h-10 text-love-pink/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t("chat.startConvo")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("chat.saySomething", { name: chatWith.display_name })}</p>
              </div>
            )}
            {messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.sender_id === userId ? "gradient-love text-white rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t border-border/50 bg-card/50">
            <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder={t("chat.typeMessage")} className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-love-pink/50" />
            <button onClick={sendMessage} disabled={!newMsg.trim() || sending} className="w-10 h-10 rounded-xl gradient-love flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4 text-white" /></button>
          </div>
        </div>
      );
    }

    if (loading) {
      return (<div className="flex-1 flex items-center justify-center pt-20"><div className="w-10 h-10 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" /></div>);
    }

    return (
      <div className="flex flex-col pt-4 px-4">
        <div className="mb-5 pt-2">
          <h2 className="text-2xl font-bold">{t("matches.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("matches.subtitle")}</p>
        </div>

        {matches.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center pt-20">
            <Heart className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t("matches.noMatches")}</h3>
            <p className="text-sm text-muted-foreground">{t("matches.noMatchesSub")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match, i) => (
              <motion.button key={match.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => openChat(match)} className="w-full flex items-center gap-3 p-3 bg-card rounded-2xl border border-border/30 hover:border-love-pink/30 transition-all text-left">
                <div className="relative">
                  <img src={match.photos?.[0] || "/placeholder.jpg"} alt={match.display_name} className="w-14 h-14 rounded-xl object-cover" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm truncate">{match.display_name}, {match.age}</h4>
                    <Shield className="w-3 h-3 text-love-pink shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{match.city || t("matches.orbVerified")}</p>
                </div>
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }
  