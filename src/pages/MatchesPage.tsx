import { motion } from "framer-motion";
import { MessageCircle, Heart, Shield } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useLocation } from "wouter";
import type { MatchWithProfile } from "@/types";

interface MatchesPageProps {
  userId: string;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function MatchesPage({ userId }: MatchesPageProps) {
  const { matches, isLoading } = useMatches(userId);
  const [, setLocation] = useLocation();

  const newMatches = matches.filter((m) => !m.last_message_at);
  const conversations = matches.filter((m) => m.last_message_at);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-love-pink/30 border-t-love-pink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-4 overflow-auto">
      <h2 className="text-2xl font-bold gradient-love-text mb-5">Matches</h2>

      {newMatches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">New Matches</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {newMatches.map((match, i) => (
              <motion.button
                key={match.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setLocation(`/chat/${match.id}`)}
                className="flex flex-col items-center shrink-0"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-love-pink p-0.5">
                  <img
                    src={match.profile?.photos?.[0] || "/placeholder.jpg"}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <span className="text-xs text-foreground/80 mt-1.5 max-w-[64px] truncate">
                  {match.profile?.display_name || "..."}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Messages</h3>

        {conversations.length === 0 && newMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-1">No matches yet</h4>
            <p className="text-sm text-muted-foreground">Keep swiping to find your people</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((match, i) => (
              <MatchItem
                key={match.id}
                match={match}
                index={i}
                onClick={() => setLocation(`/chat/${match.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchItem({
  match,
  index,
  onClick,
}: {
  match: MatchWithProfile;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-card transition-colors"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-border/50">
        <img
          src={match.profile?.photos?.[0] || "/placeholder.jpg"}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{match.profile?.display_name}</span>
          <Shield className="w-3 h-3 text-love-pink" />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          Tap to start chatting
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] text-muted-foreground">
          {formatTime(match.last_message_at)}
        </span>
        <MessageCircle className="w-4 h-4 text-love-pink" />
      </div>
    </motion.button>
  );
}
