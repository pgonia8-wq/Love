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
  