import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const ICEBREAKER_QUESTIONS = {
    en: [
      "What's your guilty pleasure that you'd never admit on a first date?",
      "If you could have dinner with anyone in history, who would it be?",
      "What's the most spontaneous thing you've ever done?",
      "What's on your bucket list that would surprise people?",
      "If you won the lottery tomorrow, what's the first thing you'd do?",
      "What's a skill you wish you had?",
      "What's your most unpopular opinion?",
      "If you could live anywhere in the world, where would it be?",
      "What's the best trip you've ever taken?",
      "What makes you laugh the hardest?",
      "What's something you're passionate about that most people don't know?",
      "If you could master any instrument overnight, which would you choose?",
      "What's the weirdest food combo you secretly love?",
      "What would your perfect Sunday look like?",
      "If your life had a soundtrack, what song would play right now?",
    ],
    es: [
      "\u00bfCu\u00e1l es tu placer culposo que nunca admitir\u00edas en una primera cita?",
      "Si pudieras cenar con alguien de la historia, \u00bfqui\u00e9n ser\u00eda?",
      "\u00bfQu\u00e9 es lo m\u00e1s espont\u00e1neo que has hecho?",
      "\u00bfQu\u00e9 tienes en tu bucket list que sorprender\u00eda a la gente?",
      "Si ganaras la loter\u00eda ma\u00f1ana, \u00bfqu\u00e9 es lo primero que har\u00edas?",
      "\u00bfQu\u00e9 habilidad te gustar\u00eda tener?",
      "\u00bfCu\u00e1l es tu opini\u00f3n m\u00e1s impopular?",
      "Si pudieras vivir en cualquier lugar del mundo, \u00bfd\u00f3nde ser\u00eda?",
      "\u00bfCu\u00e1l ha sido el mejor viaje de tu vida?",
      "\u00bfQu\u00e9 te hace re\u00edr m\u00e1s?",
      "\u00bfAlgo que te apasiona y la mayor\u00eda no sabe?",
      "Si pudieras dominar un instrumento de la noche a la ma\u00f1ana, \u00bfcu\u00e1l ser\u00eda?",
      "\u00bfCu\u00e1l es la combinaci\u00f3n de comida m\u00e1s rara que secretamente amas?",
      "\u00bfC\u00f3mo ser\u00eda tu domingo perfecto?",
      "Si tu vida tuviera un soundtrack, \u00bfqu\u00e9 canci\u00f3n sonar\u00eda ahora?",
    ],
  };

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const action = req.body?.action || req.query?.action;

    // SEND ANONYMOUS CRUSH
    if (action === "send-crush") {
      const { sender_id, target_id } = req.body;
      if (!sender_id || !target_id) return res.status(400).json({ error: "Missing fields" });
      if (sender_id === target_id) return res.status(400).json({ error: "Cannot crush yourself" });

      try {
        const { data: user } = await supabase.from("users").select("is_premium").eq("wallet_address", sender_id).single();
        const isPremium = user?.is_premium || false;

        if (!isPremium) {
          const { data: profile } = await supabase.from("profiles").select("weekly_crushes_sent, last_crush_reset_at").eq("user_id", sender_id).single();
          const lastReset = profile?.last_crush_reset_at ? new Date(profile.last_crush_reset_at) : new Date(0);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const sent = lastReset < weekAgo ? 0 : (profile?.weekly_crushes_sent || 0);
          if (sent >= 1) return res.status(403).json({ error: "Free users get 1 crush/week. Upgrade for unlimited!", limit_reached: true });
        }

        const { data: senderProfile } = await supabase.from("profiles").select("age, interests, city").eq("user_id", sender_id).single();
        const ageRange = senderProfile?.age ? (Math.floor(senderProfile.age / 5) * 5) + "-" + (Math.floor(senderProfile.age / 5) * 5 + 5) : null;
        const hintInterest = senderProfile?.interests?.length > 0 ? senderProfile.interests[Math.floor(Math.random() * senderProfile.interests.length)] : null;

        const { error } = await supabase.from("crushes").upsert({
          sender_id, target_id,
          hint_age_range: ageRange,
          hint_interest: hintInterest,
          hint_city: senderProfile?.city || null,
          is_revealed: false,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "sender_id,target_id" });

        if (error) return res.status(500).json({ error: error.message });

        const { count } = await supabase.from("crushes").select("*", { count: "exact", head: true }).eq("target_id", target_id).eq("is_revealed", false);
        await supabase.from("profiles").update({ crush_received_count: count || 0 }).eq("user_id", target_id);

        await supabase.from("profiles").update({
          weekly_crushes_sent: supabase.sql ? undefined : 1,
          last_crush_reset_at: new Date().toISOString()
        }).eq("user_id", sender_id).catch(() => {});

        await supabase.from("notifications").insert({
          user_id: target_id, type: "anonymous_crush",
          title: "Someone has a crush on you!",
          body: "A verified human sent you an anonymous crush. Hints: " + (ageRange || "?") + " years old" + (hintInterest ? ", likes " + hintInterest : ""),
          data: { crush_count: count },
        }).catch(() => {});

        return res.json({ success: true, hints: { age_range: ageRange, interest: hintInterest } });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // GET MY CRUSHES (received)
    if (action === "my-crushes") {
      const { user_id } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const { data: crushes } = await supabase.from("crushes")
          .select("id, hint_age_range, hint_interest, hint_city, is_revealed, created_at")
          .eq("target_id", user_id)
          .eq("is_revealed", false)
          .order("created_at", { ascending: false });

        return res.json({ crushes: crushes || [], count: crushes?.length || 0 });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // SPOTLIGHT STATUS
    if (action === "spotlight-status") {
      try {
        const now = new Date().toISOString();
        const { data: active } = await supabase.from("spotlight_sessions")
          .select("*")
          .lte("starts_at", now)
          .gte("ends_at", now)
          .limit(1);

        const { data: upcoming } = await supabase.from("spotlight_sessions")
          .select("starts_at, ends_at, multiplier")
          .gt("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(1);

        return res.json({
          is_active: active && active.length > 0,
          current: active?.[0] || null,
          next: upcoming?.[0] || null,
        });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // GET WEEKLY TOP 5
    if (action === "weekly-top5") {
      const { user_id } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekStr = weekStart.toISOString().split("T")[0];

        const { data: existing } = await supabase.from("weekly_top5")
          .select("*").eq("user_id", user_id).eq("week_start", weekStr).single();

        if (existing) {
          const ids = existing.recommended_ids || [];
          const { data: profiles } = await supabase.from("profiles")
            .select("user_id, display_name, age, photos, city, country, trust_score, verified_dates_count, vouch_count, interests")
            .in("user_id", ids);

          return res.json({
            top5: profiles || [],
            compatibility_scores: existing.compatibility_scores || [],
            week_start: weekStr,
          });
        }

        const { data: userProfile } = await supabase.from("profiles")
          .select("interests, city, country, looking_for, gender, age")
          .eq("user_id", user_id).single();

        if (!userProfile) return res.json({ top5: [], week_start: weekStr });

        let query = supabase.from("profiles")
          .select("user_id, display_name, age, photos, city, country, trust_score, verified_dates_count, vouch_count, interests, looking_for, gender")
          .neq("user_id", user_id)
          .eq("is_active", true)
          .limit(50);

        const { data: candidates } = await query;
        if (!candidates || candidates.length === 0) return res.json({ top5: [], week_start: weekStr });

        const scored = candidates.map(c => {
          let score = 50;
          const sharedInterests = (userProfile.interests || []).filter(i => (c.interests || []).includes(i));
          score += sharedInterests.length * 8;
          if (c.city === userProfile.city) score += 15;
          if (c.country === userProfile.country) score += 10;
          score += (c.trust_score || 50) / 5;
          score += (c.verified_dates_count || 0) * 3;
          score += (c.vouch_count || 0) * 2;
          const ageDiff = Math.abs((c.age || 25) - (userProfile.age || 25));
          score -= ageDiff * 2;
          return { ...c, compatibility: Math.min(99, Math.max(10, Math.round(score))) };
        });

        scored.sort((a, b) => b.compatibility - a.compatibility);
        const top5 = scored.slice(0, 5);

        await supabase.from("weekly_top5").upsert({
          user_id, week_start: weekStr,
          recommended_ids: top5.map(p => p.user_id),
          compatibility_scores: top5.map(p => p.compatibility),
        }, { onConflict: "user_id,week_start" });

        return res.json({ top5, compatibility_scores: top5.map(p => p.compatibility), week_start: weekStr });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // GET ICEBREAKER FOR MATCH
    if (action === "get-icebreaker") {
      const { match_id, user1_id, user2_id, lang = "en" } = req.body;
      if (!user1_id || !user2_id) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: existing } = await supabase.from("icebreakers")
          .select("*")
          .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) return res.json({ icebreaker: existing[0] });

        const questions = ICEBREAKER_QUESTIONS[lang] || ICEBREAKER_QUESTIONS.en;
        const question = questions[Math.floor(Math.random() * questions.length)];

        const { data, error } = await supabase.from("icebreakers").insert({
          match_id, user1_id, user2_id, question,
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ icebreaker: data });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // ANSWER ICEBREAKER
    if (action === "answer-icebreaker") {
      const { icebreaker_id, user_id, answer } = req.body;
      if (!icebreaker_id || !user_id || !answer) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: ice } = await supabase.from("icebreakers").select("*").eq("id", icebreaker_id).single();
        if (!ice) return res.status(404).json({ error: "Not found" });

        const isUser1 = ice.user1_id === user_id;
        const updates = isUser1 ? { user1_answer: answer } : { user2_answer: answer };
        const otherAnswered = isUser1 ? !!ice.user2_answer : !!ice.user1_answer;
        if (otherAnswered) updates.both_answered = true;

        await supabase.from("icebreakers").update(updates).eq("id", icebreaker_id);
        return res.json({ success: true, both_answered: otherAnswered });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // SOCIAL PROOF
    if (action === "social-proof") {
      const { user_id } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const { data } = await supabase.from("profiles")
          .select("avg_response_time_min, ghost_rate_pct, match_rate_pct, response_badge, social_proof_tags, trust_score, verified_dates_count, vouch_count, crush_received_count")
          .eq("user_id", user_id).single();

        if (!data) return res.json({ proof: null });

        const badges = [];
        if (data.avg_response_time_min && data.avg_response_time_min < 30) badges.push("fast_responder");
        if (data.ghost_rate_pct !== null && data.ghost_rate_pct < 5) badges.push("never_ghosts");
        if (data.match_rate_pct && data.match_rate_pct > 40) badges.push("popular");
        if (data.verified_dates_count && data.verified_dates_count >= 3) badges.push("experienced_dater");
        if (data.vouch_count && data.vouch_count >= 3) badges.push("community_trusted");

        return res.json({
          proof: {
            response_time: data.avg_response_time_min,
            ghost_rate: data.ghost_rate_pct,
            match_rate: data.match_rate_pct,
            trust_score: data.trust_score,
            verified_dates: data.verified_dates_count,
            vouches: data.vouch_count,
            crushes_received: data.crush_received_count,
            badges,
            response_badge: data.response_badge,
            tags: data.social_proof_tags || [],
          }
        });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    return res.status(400).json({ error: "Invalid action" });
  }
  