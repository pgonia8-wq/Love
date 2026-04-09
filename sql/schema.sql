-- H Love - Complete Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

-- Users table (core auth via World ID)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id_hash TEXT UNIQUE NOT NULL,
  nullifier_hash TEXT UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT TRUE,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  referred_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT DEFAULT '',
  age INTEGER NOT NULL CHECK (age >= 18),
  gender TEXT NOT NULL DEFAULT 'other' CHECK (gender IN ('male', 'female', 'other')),
  looking_for TEXT DEFAULT 'everyone' CHECK (looking_for IN ('men', 'women', 'everyone', 'friends')),
  interests TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  city TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  boost_active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swipes table
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'superlike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  last_message_at TIMESTAMPTZ,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'meetup' CHECK (event_type IN ('speed_dating', 'networking', 'meetup', 'workshop')),
  cover_image TEXT DEFAULT '',
  location TEXT DEFAULT '',
  city TEXT DEFAULT '',
  event_date TIMESTAMPTZ NOT NULL,
  max_attendees INTEGER DEFAULT 50,
  current_attendees INTEGER DEFAULT 0,
  ticket_price_wld DECIMAL(10, 4) DEFAULT 0,
  ticket_price_usdc DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event tickets table
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_currency TEXT NOT NULL CHECK (payment_currency IN ('WLD', 'USDC')),
  payment_amount DECIMAL(10, 4) DEFAULT 0,
  payment_tx_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'boost', 'superlike', 'see_likes', 'event_ticket')),
  currency TEXT NOT NULL CHECK (currency IN ('WLD', 'USDC')),
  amount DECIMAL(10, 4) NOT NULL,
  platform_fee DECIMAL(10, 4) DEFAULT 0,
  tx_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'premium_monthly' CHECK (plan IN ('premium_monthly')),
  currency TEXT NOT NULL CHECK (currency IN ('WLD', 'USDC')),
  amount DECIMAL(10, 2) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT TRUE
);

-- Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_type TEXT DEFAULT 'boost' CHECK (reward_type IN ('boost', 'wld')),
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'fake', 'harassment', 'underage', 'other')),
  details TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON public.swipes(swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON public.swipes(swiped_id);
CREATE INDEX IF NOT EXISTS idx_swipes_pair ON public.swipes(swiper_id, swiped_id);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_active ON public.matches(is_active);
CREATE INDEX IF NOT EXISTS idx_messages_match ON public.messages(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_event_tickets_user ON public.event_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (TRUE);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (TRUE);

-- Swipes policies
CREATE POLICY "Users can read own swipes" ON public.swipes
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can create swipes" ON public.swipes
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can delete own swipes" ON public.swipes
  FOR DELETE USING (TRUE);

-- Matches policies
CREATE POLICY "Users can read their matches" ON public.matches
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can create matches" ON public.matches
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can update matches" ON public.matches
  FOR UPDATE USING (TRUE);

-- Messages policies
CREATE POLICY "Users can read messages in their matches" ON public.messages
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can update message read status" ON public.messages
  FOR UPDATE USING (TRUE);

-- Events policies
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage events" ON public.events
  FOR ALL USING (auth.role() = 'service_role');

-- Event tickets policies
CREATE POLICY "Users can read own tickets" ON public.event_tickets
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage tickets" ON public.event_tickets
  FOR ALL USING (auth.role() = 'service_role');

-- Payments policies
CREATE POLICY "Users can read own payments" ON public.payments
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage payments" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');

-- Subscriptions policies
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Referrals policies
CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage referrals" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- Reports policies
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can read own reports" ON public.reports
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role can manage reports" ON public.reports
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Increment event attendee count on ticket purchase
CREATE OR REPLACE FUNCTION public.increment_attendees()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.events
  SET current_attendees = current_attendees + 1
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ticket_purchased
  AFTER INSERT ON public.event_tickets
  FOR EACH ROW EXECUTE FUNCTION public.increment_attendees();

-- ============================================
-- CRON JOBS (requires pg_cron extension)
-- Enable in Supabase: Database > Extensions > pg_cron
-- ============================================

-- Expire premium subscriptions
-- Run every hour
SELECT cron.schedule(
  'expire-premium-subscriptions',
  '0 * * * *',
  $$
    UPDATE public.users
    SET is_premium = FALSE, premium_expires_at = NULL
    WHERE is_premium = TRUE
      AND premium_expires_at IS NOT NULL
      AND premium_expires_at < NOW();

    UPDATE public.subscriptions
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND expires_at < NOW();
  $$
);

-- Expire profile boosts
-- Run every 5 minutes
SELECT cron.schedule(
  'expire-profile-boosts',
  '*/5 * * * *',
  $$
    UPDATE public.profiles
    SET boost_active_until = NULL
    WHERE boost_active_until IS NOT NULL
      AND boost_active_until < NOW();
  $$
);

-- Clean up old passed swipes (older than 30 days) to save space
-- Run daily at 3 AM
SELECT cron.schedule(
  'cleanup-old-swipes',
  '0 3 * * *',
  $$
    DELETE FROM public.swipes
    WHERE action = 'pass'
      AND created_at < NOW() - INTERVAL '30 days';
  $$
);

-- Deactivate events that have passed
-- Run every hour
SELECT cron.schedule(
  'deactivate-past-events',
  '0 * * * *',
  $$
    UPDATE public.events
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND event_date < NOW() - INTERVAL '1 day';
  $$
);

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone can read photos
CREATE POLICY "Public read access for photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- Storage policy: authenticated users can upload photos
CREATE POLICY "Users can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

-- Storage policy: users can delete their own photos
CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for matches and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- SEED DATA (sample events)
-- ============================================

INSERT INTO public.events (title, description, event_type, location, city, event_date, max_attendees, ticket_price_wld, ticket_price_usdc)
VALUES
  ('Speed Dating Night', 'Meet 10+ verified humans in one evening. Rotating conversations, real connections.', 'speed_dating', 'The Loft Bar', 'Mexico City', NOW() + INTERVAL '7 days', 30, 2.5, 9.99),
  ('Crypto & Coffee Networking', 'Casual meetup for crypto enthusiasts. Great coffee, great conversations.', 'networking', 'Cafe Blockchain', 'Buenos Aires', NOW() + INTERVAL '14 days', 50, 1.0, 4.99),
  ('Verified Humans Meetup', 'An exclusive social gathering for Orb-verified humans. Drinks and good vibes.', 'meetup', 'Sky Lounge', 'Bogota', NOW() + INTERVAL '21 days', 40, 1.5, 7.99)
ON CONFLICT DO NOTHING;
