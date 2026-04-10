-- ============================================
  -- H LOVE - Base Schema Migration (V0)
  -- Creates foundational tables that all other
  -- migrations depend on. Run this FIRST.
  -- ============================================

  -- 1. USERS (core auth table)
  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address text UNIQUE NOT NULL,
    username text,
    nullifier_hash text UNIQUE,
    is_premium boolean DEFAULT false,
    premium_expires_at timestamptz,
    is_verified boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium) WHERE is_premium = true;

  -- 2. PROFILES (main profile data)
  CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,
    display_name text NOT NULL DEFAULT 'User',
    age integer,
    gender text,
    looking_for text,
    bio text,
    photos text[] DEFAULT '{}',
    interests text[] DEFAULT '{}',
    city text,
    location_lat double precision,
    location_lng double precision,
    last_active_at timestamptz DEFAULT now(),
    is_active boolean DEFAULT true,
    boost_active_until timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender, looking_for) WHERE is_active = true;

  -- 3. SWIPES
  CREATE TABLE IF NOT EXISTS swipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id text NOT NULL,
    swiped_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('like', 'pass', 'superlike')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(swiper_id, swiped_id)
  );
  CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id);
  CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes(swiped_id);
  CREATE INDEX IF NOT EXISTS idx_swipes_action ON swipes(action) WHERE action IN ('like', 'superlike');

  -- 4. MATCHES
  CREATE TABLE IF NOT EXISTS matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id text NOT NULL,
    user2_id text NOT NULL,
    matched_at timestamptz DEFAULT now(),
    is_active boolean DEFAULT true,
    last_message_at timestamptz,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id);

  -- 5. MESSAGES
  CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id),
    sender_id text NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

  -- 6. PAYMENTS
  CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    payment_type text NOT NULL,
    currency text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    platform_fee numeric DEFAULT 0,
    tx_id text,
    reference text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_tx ON payments(tx_id);

  -- 7. SUBSCRIPTIONS
  CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,
    plan text NOT NULL DEFAULT 'premium_monthly',
    currency text,
    amount numeric DEFAULT 0,
    started_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    auto_renew boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active) WHERE is_active = true;

  -- 8. REPORTS
  CREATE TABLE IF NOT EXISTS reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id text NOT NULL,
    reported_user_id text NOT NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

  -- 9. EVENTS
  CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    event_type text DEFAULT 'meetup',
    city text,
    country text,
    venue text,
    event_date timestamptz,
    max_attendees integer DEFAULT 50,
    price_usdc numeric DEFAULT 0,
    price_wld numeric DEFAULT 0,
    cover_image text,
    organizer_id text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date) WHERE is_active = true;

  -- 10. EVENT TICKETS
  CREATE TABLE IF NOT EXISTS event_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id),
    user_id text NOT NULL,
    payment_currency text,
    payment_amount numeric DEFAULT 0,
    payment_tx_id text,
    checked_in boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(event_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_event_tickets_event ON event_tickets(event_id);
  CREATE INDEX IF NOT EXISTS idx_event_tickets_user ON event_tickets(user_id);

  -- RLS for all base tables
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

  CREATE POLICY IF NOT EXISTS "Full access users" ON users FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access profiles" ON profiles FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access swipes" ON swipes FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access matches" ON matches FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access messages" ON messages FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access payments" ON payments FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access subscriptions" ON subscriptions FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access reports" ON reports FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access events" ON events FOR ALL USING (true);
  CREATE POLICY IF NOT EXISTS "Full access event_tickets" ON event_tickets FOR ALL USING (true);

  SELECT 'V0 Base Schema completed!' as status;
  