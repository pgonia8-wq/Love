import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Shield } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface ChatPageProps {
  userId: string;
}

export default function ChatPage({ userId }: ChatPageProps) {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, isSending } = useChat(matchId, userId);

  const { data: matchData } = useQuery({
    queryKey: ["match-detail", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match) return null;

      const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", otherId)
        .single();

      return { match, profile };
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    await sendMessage(text);
  };

  const profile = matchData?.profile;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <button
          onClick={() => setLocation("/matches")}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50">
          <img
            src={profile?.photos?.[0] || "/placeholder.jpg"}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">{profile?.display_name || "..."}</span>
            <Shield className="w-3 h-3 text-love-pink" />
          </div>
          <span className="text-xs text-muted-foreground">Orb Verified</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-love-pink mb-4">
              <img
                src={profile?.photos?.[0] || "/placeholder.jpg"}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Say hi to {profile?.display_name || "your match"}!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === userId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "gradient-love text-white rounded-br-sm"
                      : "bg-card text-foreground border border-border/50 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  <div
                    className={`text-[10px] mt-1 ${
                      isMe ? "text-white/50" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 h-11 px-4 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-love-pink/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="w-11 h-11 rounded-xl gradient-love flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4.5 h-4.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
