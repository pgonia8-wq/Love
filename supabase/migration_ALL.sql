-- ============================================
  -- H LOVE - MASTER MIGRATION (ALL FIXED)
  -- Run this single file in Supabase SQL Editor
  -- Safe to run multiple times
  -- ============================================

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

  DROP POLICY IF EXISTS "Full access users" ON users;
  CREATE POLICY "Full access users" ON users FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access profiles" ON profiles;
  CREATE POLICY "Full access profiles" ON profiles FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access swipes" ON swipes;
  CREATE POLICY "Full access swipes" ON swipes FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access matches" ON matches;
  CREATE POLICY "Full access matches" ON matches FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access messages" ON messages;
  CREATE POLICY "Full access messages" ON messages FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access payments" ON payments;
  CREATE POLICY "Full access payments" ON payments FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access subscriptions" ON subscriptions;
  CREATE POLICY "Full access subscriptions" ON subscriptions FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access reports" ON reports;
  CREATE POLICY "Full access reports" ON reports FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access events" ON events;
  CREATE POLICY "Full access events" ON events FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access event_tickets" ON event_tickets;
  CREATE POLICY "Full access event_tickets" ON event_tickets FOR ALL USING (true);

  SELECT 'V0 Base Schema completed!' as status;
  

  -- ============================================
  -- V1: GEO FEATURES
  -- ============================================

  -- ============================================
  -- H LOVE - Complete Database Migration
  -- Run this in Supabase SQL Editor (one time)
  -- ============================================

  -- 1. Add geo columns to profiles
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_set_at timestamptz;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_distance_km integer DEFAULT 50;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_verified boolean DEFAULT false;

  -- Travel mode columns (premium only)
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_active boolean DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_city text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_country text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_country_code text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_lat double precision;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_lng double precision;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_expires_at timestamptz;

  -- Online status
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS compatibility_score integer;

  -- 2. Create blocks table
  CREATE TABLE IF NOT EXISTS blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id text NOT NULL,
    blocked_id text NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(blocker_id, blocked_id)
  );

  -- 3. Create boosts table
  CREATE TABLE IF NOT EXISTS boosts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    boost_type text NOT NULL DEFAULT 'standard',
    started_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    reach_multiplier integer DEFAULT 10,
    views_gained integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );

  -- 4. Create user_location_history table
  CREATE TABLE IF NOT EXISTS user_location_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    city text,
    country text,
    country_code text,
    recorded_at timestamptz DEFAULT now()
  );

  -- 5. Create notifications table
  CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    data jsonb,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );

  -- 6. Create user_settings table
  CREATE TABLE IF NOT EXISTS user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,
    show_distance boolean DEFAULT true,
    show_online_status boolean DEFAULT true,
    show_last_active boolean DEFAULT true,
    age_range_min integer DEFAULT 18,
    age_range_max integer DEFAULT 99,
    distance_unit text DEFAULT 'km',
    push_matches boolean DEFAULT true,
    push_messages boolean DEFAULT true,
    push_likes boolean DEFAULT true,
    push_nearby boolean DEFAULT true,
    incognito_mode boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- 7. Create passport_history table (premium country changes)
  CREATE TABLE IF NOT EXISTS passport_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    from_country text,
    from_country_code text,
    to_country text NOT NULL,
    to_country_code text NOT NULL,
    changed_at timestamptz DEFAULT now(),
    next_change_allowed_at timestamptz NOT NULL
  );

  -- 8. Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_profiles_geo ON profiles(location_lat, location_lng) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_profiles_travel ON profiles(travel_active) WHERE travel_active = true;
  CREATE INDEX IF NOT EXISTS idx_profiles_boost ON profiles(boost_active_until) WHERE boost_active_until > now();
  CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online) WHERE is_online = true;
  CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
  CREATE INDEX IF NOT EXISTS idx_boosts_user ON boosts(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
  CREATE INDEX IF NOT EXISTS idx_swipes_user ON swipes(user_id);
  CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_user_id);
  CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id);

  -- 9. Distance calculation function (Haversine formula)
  CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 double precision, lng1 double precision,
    lat2 double precision, lng2 double precision
  ) RETURNS double precision AS $$
  DECLARE
    R double precision := 6371;
    dlat double precision;
    dlng double precision;
    a double precision;
    c double precision;
  BEGIN
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
  END;
  $$ LANGUAGE plpgsql IMMUTABLE;

  -- 10. Get nearby profiles function
  CREATE OR REPLACE FUNCTION get_nearby_profiles(
    p_user_id text,
    p_lat double precision,
    p_lng double precision,
    p_max_distance_km integer DEFAULT 50,
    p_limit integer DEFAULT 50,
    p_gender_filter text DEFAULT NULL,
    p_age_min integer DEFAULT 18,
    p_age_max integer DEFAULT 99
  ) RETURNS TABLE (
    user_id text,
    display_name text,
    bio text,
    age integer,
    gender text,
    looking_for text,
    interests text[],
    photos text[],
    city text,
    country text,
    location_lat double precision,
    location_lng double precision,
    is_online boolean,
    last_active_at timestamptz,
    boost_active_until timestamptz,
    distance_km double precision,
    is_boosted boolean,
    is_verified boolean
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT
      p.user_id,
      p.display_name,
      p.bio,
      p.age,
      p.gender,
      p.looking_for,
      p.interests,
      p.photos,
      p.city,
      p.country,
      COALESCE(CASE WHEN p.travel_active THEN p.travel_lat ELSE p.location_lat END, p.location_lat) as location_lat,
      COALESCE(CASE WHEN p.travel_active THEN p.travel_lng ELSE p.location_lng END, p.location_lng) as location_lng,
      p.is_online,
      p.last_active_at,
      p.boost_active_until,
      calculate_distance_km(
        p_lat, p_lng,
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lat ELSE p.location_lat END, p.location_lat),
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lng ELSE p.location_lng END, p.location_lng)
      ) as distance_km,
      (p.boost_active_until IS NOT NULL AND p.boost_active_until > now()) as is_boosted,
      COALESCE(p.location_verified, false) as is_verified
    FROM profiles p
    WHERE p.user_id != p_user_id
      AND p.is_active = true
      AND p.age >= p_age_min
      AND p.age <= p_age_max
      AND (p_gender_filter IS NULL OR p.gender = p_gender_filter)
      AND p.user_id NOT IN (SELECT b.blocked_id FROM blocks b WHERE b.blocker_id = p_user_id)
      AND p.user_id NOT IN (SELECT s.target_user_id FROM swipes s WHERE s.user_id = p_user_id)
      AND calculate_distance_km(
        p_lat, p_lng,
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lat ELSE p.location_lat END, p.location_lat),
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lng ELSE p.location_lng END, p.location_lng)
      ) <= p_max_distance_km
    ORDER BY
      (p.boost_active_until IS NOT NULL AND p.boost_active_until > now()) DESC,
      calculate_distance_km(
        p_lat, p_lng,
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lat ELSE p.location_lat END, p.location_lat),
        COALESCE(CASE WHEN p.travel_active THEN p.travel_lng ELSE p.location_lng END, p.location_lng)
      ) ASC,
      p.last_active_at DESC NULLS LAST
    LIMIT p_limit;
  END;
  $$ LANGUAGE plpgsql STABLE;

  -- 11. RLS policies
  ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE boosts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_location_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE passport_history ENABLE ROW LEVEL SECURITY;

  -- Allow service role full access
  DROP POLICY IF EXISTS "Service role full access blocks" ON blocks;
CREATE POLICY "Service role full access blocks" ON blocks FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access boosts" ON boosts;
CREATE POLICY "Service role full access boosts" ON boosts FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access settings" ON user_settings;
CREATE POLICY "Service role full access settings" ON user_settings FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access location_history" ON user_location_history;
CREATE POLICY "Service role full access location_history" ON user_location_history FOR ALL USING (true);
  DROP POLICY IF EXISTS "Service role full access passport" ON passport_history;
CREATE POLICY "Service role full access passport" ON passport_history FOR ALL USING (true);

  -- 12. Update mock profiles with geo data
  UPDATE profiles SET
    country = CASE city
      WHEN 'Mexico City' THEN 'Mexico' WHEN 'Guadalajara' THEN 'Mexico' WHEN 'Cancun' THEN 'Mexico'
      WHEN 'Bogota' THEN 'Colombia' WHEN 'Medellin' THEN 'Colombia' WHEN 'Cartagena' THEN 'Colombia'
      WHEN 'Buenos Aires' THEN 'Argentina' WHEN 'Lima' THEN 'Peru' WHEN 'Santiago' THEN 'Chile'
      WHEN 'Madrid' THEN 'Spain' WHEN 'Barcelona' THEN 'Spain'
      WHEN 'Montevideo' THEN 'Uruguay' WHEN 'San Jose' THEN 'Costa Rica'
      WHEN 'Quito' THEN 'Ecuador' WHEN 'Panama City' THEN 'Panama'
      ELSE 'Unknown'
    END,
    country_code = CASE city
      WHEN 'Mexico City' THEN 'MX' WHEN 'Guadalajara' THEN 'MX' WHEN 'Cancun' THEN 'MX'
      WHEN 'Bogota' THEN 'CO' WHEN 'Medellin' THEN 'CO' WHEN 'Cartagena' THEN 'CO'
      WHEN 'Buenos Aires' THEN 'AR' WHEN 'Lima' THEN 'PE' WHEN 'Santiago' THEN 'CL'
      WHEN 'Madrid' THEN 'ES' WHEN 'Barcelona' THEN 'ES'
      WHEN 'Montevideo' THEN 'UY' WHEN 'San Jose' THEN 'CR'
      WHEN 'Quito' THEN 'EC' WHEN 'Panama City' THEN 'PA'
      ELSE 'XX'
    END,
    location_lat = CASE city
      WHEN 'Mexico City' THEN 19.4326 WHEN 'Guadalajara' THEN 20.6597
      WHEN 'Cancun' THEN 21.1619 WHEN 'Bogota' THEN 4.7110
      WHEN 'Medellin' THEN 6.2476 WHEN 'Cartagena' THEN 10.3910
      WHEN 'Buenos Aires' THEN -34.6037 WHEN 'Lima' THEN -12.0464
      WHEN 'Santiago' THEN -33.4489 WHEN 'Madrid' THEN 40.4168
      WHEN 'Barcelona' THEN 41.3874 WHEN 'Montevideo' THEN -34.9011
      WHEN 'San Jose' THEN 9.9281 WHEN 'Quito' THEN -0.1807
      WHEN 'Panama City' THEN 8.9824
      ELSE 19.4326
    END + (random() * 0.1 - 0.05),
    location_lng = CASE city
      WHEN 'Mexico City' THEN -99.1332 WHEN 'Guadalajara' THEN -103.3496
      WHEN 'Cancun' THEN -86.8515 WHEN 'Bogota' THEN -74.0721
      WHEN 'Medellin' THEN -75.5658 WHEN 'Cartagena' THEN -75.5144
      WHEN 'Buenos Aires' THEN -58.3816 WHEN 'Lima' THEN -77.0428
      WHEN 'Santiago' THEN -70.6693 WHEN 'Madrid' THEN -3.7038
      WHEN 'Barcelona' THEN 2.1686 WHEN 'Montevideo' THEN -56.1645
      WHEN 'San Jose' THEN -84.0907 WHEN 'Quito' THEN -78.4678
      WHEN 'Panama City' THEN -79.5199
      ELSE -99.1332
    END + (random() * 0.1 - 0.05),
    is_online = (random() > 0.6),
    country_set_at = now() - interval '30 days',
    max_distance_km = (ARRAY[25, 50, 100, 200])[floor(random() * 4 + 1)::int],
    location_verified = (random() > 0.3)
  WHERE user_id LIKE '0xmock_%';

  SELECT 'Migration completed successfully!' as status;
  

  -- ============================================
  -- V2: TRUST FEATURES
  -- ============================================

  -- ============================================
  -- H LOVE - Differentiator Features Migration
  -- Proof of Date + Trust Score + Vouched By
  -- Run in Supabase SQL Editor
  -- ============================================

  -- 1. PROOF OF DATE
  CREATE TABLE IF NOT EXISTS date_confirmations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid,
    requester_id text NOT NULL,
    confirmer_id text NOT NULL,
    date_location text,
    date_date timestamptz DEFAULT now(),
    requester_confirmed boolean DEFAULT true,
    confirmer_confirmed boolean DEFAULT false,
    both_confirmed boolean DEFAULT false,
    confirmed_at timestamptz,
    created_at timestamptz DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_date_conf_requester ON date_confirmations(requester_id);
  CREATE INDEX IF NOT EXISTS idx_date_conf_confirmer ON date_confirmations(confirmer_id);
  CREATE INDEX IF NOT EXISTS idx_date_conf_both ON date_confirmations(both_confirmed) WHERE both_confirmed = true;

  -- Add date count to profiles
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_dates_count integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 50;

  -- 2. TRUST SCORE
  CREATE TABLE IF NOT EXISTS trust_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id text NOT NULL,
    reviewed_id text NOT NULL,
    date_confirmation_id uuid REFERENCES date_confirmations(id),
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    tags text[] DEFAULT '{}',
    is_anonymous boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(reviewer_id, date_confirmation_id)
  );

  CREATE INDEX IF NOT EXISTS idx_trust_reviews_reviewed ON trust_reviews(reviewed_id);

  -- Trust score components table
  CREATE TABLE IF NOT EXISTS trust_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,
    response_rate numeric DEFAULT 0,
    ghost_rate numeric DEFAULT 0,
    date_show_rate numeric DEFAULT 0,
    avg_review_rating numeric DEFAULT 0,
    report_count integer DEFAULT 0,
    vouch_count integer DEFAULT 0,
    verified_dates integer DEFAULT 0,
    calculated_score integer DEFAULT 50,
    last_calculated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_trust_metrics_user ON trust_metrics(user_id);

  -- 3. VOUCHED BY
  CREATE TABLE IF NOT EXISTS vouches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id text NOT NULL,
    vouched_id text NOT NULL,
    vouch_text text,
    relationship text DEFAULT 'met_on_hlove',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(voucher_id, vouched_id)
  );

  CREATE INDEX IF NOT EXISTS idx_vouches_vouched ON vouches(vouched_id) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_vouches_voucher ON vouches(voucher_id);

  -- Add vouch count to profiles
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vouch_count integer DEFAULT 0;

  -- RLS
  ALTER TABLE date_confirmations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE trust_reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE trust_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Full access date_confirmations" ON date_confirmations;
  CREATE POLICY "Full access date_confirmations" ON date_confirmations FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access trust_reviews" ON trust_reviews;
  CREATE POLICY "Full access trust_reviews" ON trust_reviews FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access trust_metrics" ON trust_metrics;
  CREATE POLICY "Full access trust_metrics" ON trust_metrics FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access vouches" ON vouches;
  CREATE POLICY "Full access vouches" ON vouches FOR ALL USING (true);

  -- Trust score calculation function
  CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id text)
  RETURNS integer AS $$
  DECLARE
    v_score integer := 50;
    v_dates integer;
    v_avg_rating numeric;
    v_vouches integer;
    v_reports integer;
    v_ghost numeric;
  BEGIN
    SELECT COUNT(*) INTO v_dates FROM date_confirmations WHERE (requester_id = p_user_id OR confirmer_id = p_user_id) AND both_confirmed = true;
    SELECT COALESCE(AVG(rating), 3) INTO v_avg_rating FROM trust_reviews WHERE reviewed_id = p_user_id;
    SELECT COUNT(*) INTO v_vouches FROM vouches WHERE vouched_id = p_user_id AND is_active = true;
    SELECT COUNT(*) INTO v_reports FROM reports WHERE reported_user_id = p_user_id;

    v_score := 50;
    v_score := v_score + LEAST(v_dates * 5, 20);
    v_score := v_score + CASE WHEN v_avg_rating >= 4.5 THEN 15 WHEN v_avg_rating >= 4 THEN 10 WHEN v_avg_rating >= 3 THEN 5 ELSE 0 END;
    v_score := v_score + LEAST(v_vouches * 3, 15);
    v_score := v_score - LEAST(v_reports * 10, 30);
    v_score := GREATEST(0, LEAST(100, v_score));

    UPDATE profiles SET trust_score = v_score WHERE user_id = p_user_id;
    INSERT INTO trust_metrics (user_id, verified_dates, avg_review_rating, vouch_count, report_count, calculated_score, last_calculated_at)
    VALUES (p_user_id, v_dates, v_avg_rating, v_vouches, v_reports, v_score, now())
    ON CONFLICT (user_id) DO UPDATE SET verified_dates = v_dates, avg_review_rating = v_avg_rating, vouch_count = v_vouches, report_count = v_reports, calculated_score = v_score, last_calculated_at = now();

    RETURN v_score;
  END;
  $$ LANGUAGE plpgsql;

  -- Set initial trust scores for mock profiles
  UPDATE profiles SET
    trust_score = 50 + floor(random() * 45)::int,
    verified_dates_count = floor(random() * 8)::int,
    vouch_count = floor(random() * 6)::int
  WHERE user_id LIKE '0xmock_%';

  SELECT 'V2 Migration completed!' as status;
  

  -- ============================================
  -- V3: FOMO FEATURES
  -- ============================================

  -- ============================================
  -- H LOVE - V3 Features Migration
  -- Spotlight, Crush, Top5, Icebreaker, Social Proof
  -- Run in Supabase SQL Editor
  -- ============================================

  -- 1. ANONYMOUS CRUSH
  CREATE TABLE IF NOT EXISTS crushes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id text NOT NULL,
    target_id text NOT NULL,
    hint_age_range text,
    hint_interest text,
    hint_city text,
    is_revealed boolean DEFAULT false,
    revealed_at timestamptz,
    expires_at timestamptz DEFAULT (now() + interval '7 days'),
    created_at timestamptz DEFAULT now(),
    UNIQUE(sender_id, target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_crushes_target ON crushes(target_id) WHERE is_revealed = false;
  CREATE INDEX IF NOT EXISTS idx_crushes_sender ON crushes(sender_id);

  -- 2. WEEKLY TOP 5
  CREATE TABLE IF NOT EXISTS weekly_top5 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    week_start date NOT NULL,
    recommended_ids text[] NOT NULL DEFAULT '{}',
    compatibility_scores integer[] DEFAULT '{}',
    viewed_ids text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, week_start)
  );
  CREATE INDEX IF NOT EXISTS idx_weekly_top5_user ON weekly_top5(user_id, week_start);

  -- 3. ICEBREAKER QUESTIONS
  CREATE TABLE IF NOT EXISTS icebreakers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid,
    user1_id text NOT NULL,
    user2_id text NOT NULL,
    question text NOT NULL,
    user1_answer text,
    user2_answer text,
    both_answered boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_icebreakers_match ON icebreakers(match_id);
  CREATE INDEX IF NOT EXISTS idx_icebreakers_users ON icebreakers(user1_id, user2_id);

  -- 4. SOCIAL PROOF METRICS
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_response_time_min integer;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ghost_rate_pct integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS match_rate_pct integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS response_badge text;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_proof_tags text[] DEFAULT '{}';

  -- 5. SPOTLIGHT HOURS
  CREATE TABLE IF NOT EXISTS spotlight_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    multiplier integer DEFAULT 3,
    is_active boolean DEFAULT false,
    participants integer DEFAULT 0,
    matches_created integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_spotlight_active ON spotlight_sessions(is_active, starts_at);

  -- 6. CRUSH COUNTER (for FOMO)
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crush_received_count integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_crushes_sent integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_crush_reset_at timestamptz DEFAULT now();

  -- RLS
  ALTER TABLE crushes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE weekly_top5 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE icebreakers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE spotlight_sessions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Full access crushes" ON crushes;
  CREATE POLICY "Full access crushes" ON crushes FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access weekly_top5" ON weekly_top5;
  CREATE POLICY "Full access weekly_top5" ON weekly_top5 FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access icebreakers" ON icebreakers;
  CREATE POLICY "Full access icebreakers" ON icebreakers FOR ALL USING (true);

  DROP POLICY IF EXISTS "Full access spotlight" ON spotlight_sessions;
  CREATE POLICY "Full access spotlight" ON spotlight_sessions FOR ALL USING (true);

  -- Generate social proof for mock profiles
  UPDATE profiles SET
    avg_response_time_min = CASE
      WHEN random() > 0.7 THEN floor(random() * 30 + 5)::int
      WHEN random() > 0.4 THEN floor(random() * 120 + 30)::int
      ELSE floor(random() * 360 + 60)::int
    END,
    ghost_rate_pct = floor(random() * 25)::int,
    match_rate_pct = floor(random() * 60 + 15)::int,
    response_badge = CASE
      WHEN random() > 0.6 THEN 'fast_responder'
      WHEN random() > 0.3 THEN 'active_chatter'
      ELSE NULL
    END,
    social_proof_tags = CASE
      WHEN random() > 0.5 THEN ARRAY['never_ghosts', 'fast_reply']
      WHEN random() > 0.3 THEN ARRAY['active_chatter']
      ELSE ARRAY[]::text[]
    END,
    crush_received_count = floor(random() * 8)::int
  WHERE user_id LIKE '0xmock_%';

  -- Create initial spotlight sessions (next 7 days)
  INSERT INTO spotlight_sessions (starts_at, ends_at, multiplier, is_active)
  SELECT
    date_trunc('day', now()) + (n || ' days')::interval + (floor(random() * 14 + 8) || ' hours')::interval,
    date_trunc('day', now()) + (n || ' days')::interval + (floor(random() * 14 + 9) || ' hours')::interval,
    3, false
  FROM generate_series(0, 6) n
  ON CONFLICT DO NOTHING;

  SELECT 'V3 Migration completed!' as status;
  

  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
  