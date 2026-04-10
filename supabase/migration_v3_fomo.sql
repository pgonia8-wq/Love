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

  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access crushes' AND tablename = 'crushes') THEN CREATE POLICY "Full access crushes" ON crushes FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access weekly_top5' AND tablename = 'weekly_top5') THEN CREATE POLICY "Full access weekly_top5" ON weekly_top5 FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access icebreakers' AND tablename = 'icebreakers') THEN CREATE POLICY "Full access icebreakers" ON icebreakers FOR ALL USING (true); END IF; END $;
  DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Full access spotlight' AND tablename = 'spotlight_sessions') THEN CREATE POLICY "Full access spotlight" ON spotlight_sessions FOR ALL USING (true); END IF; END $;

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
  