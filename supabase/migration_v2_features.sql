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

  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access date_confirmations' AND tablename = 'date_confirmations') THEN CREATE POLICY "Full access date_confirmations" ON date_confirmations FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access trust_reviews' AND tablename = 'trust_reviews') THEN CREATE POLICY "Full access trust_reviews" ON trust_reviews FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access trust_metrics' AND tablename = 'trust_metrics') THEN CREATE POLICY "Full access trust_metrics" ON trust_metrics FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access vouches' AND tablename = 'vouches') THEN CREATE POLICY "Full access vouches" ON vouches FOR ALL USING (true); END IF; END $;

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
  