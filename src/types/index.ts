export interface User {
  id: string;
  wallet_address: string;
  username: string | null;
  world_id_hash?: string;
  nullifier_hash?: string;
  is_verified: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  verification_level?: string;
  referral_code?: string;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  age: number;
  gender: string;
  looking_for: string;
  interests: string[];
  photos: string[];
  location_lat: number | null;
  location_lng: number | null;
  city: string;
  is_active: boolean;
  last_active_at: string;
  boost_active_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Swipe {
  id: string;
  swiper_id: string;
  swiped_id: string;
  action: "like" | "pass" | "superlike";
  created_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  matched_at: string;
  is_active: boolean;
  last_message_at: string | null;
}

export interface MatchWithProfile extends Match {
  profile: Profile;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  event_type: "speed_dating" | "networking" | "meetup" | "workshop";
  cover_image: string;
  location: string;
  city: string;
  event_date: string;
  max_attendees: number;
  current_attendees: number;
  ticket_price_wld: number;
  ticket_price_usdc: number;
  is_active: boolean;
  created_at: string;
}

export interface EventTicket {
  id: string;
  event_id: string;
  user_id: string;
  payment_currency: "WLD" | "USDC";
  payment_amount: number;
  payment_tx_id: string;
  purchased_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  payment_type: "subscription" | "boost" | "superlike" | "see_likes" | "event_ticket";
  currency: "WLD" | "USDC";
  amount: number;
  platform_fee: number;
  tx_id: string;
  status: "pending" | "confirmed" | "failed";
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: "premium_monthly";
  currency: "WLD" | "USDC";
  amount: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  auto_renew: boolean;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_type: "boost" | "wld";
  reward_claimed: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
}

export interface UserStats {
  totalSwipes: number;
  totalMatches: number;
  totalSuperLikes: number;
  profileViews: number;
  matchRate: number;
}

export interface SwipeProfile extends Profile {
  compatibility_score?: number;
  distance_km?: number;
}
