import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const action = req.body?.action || req.query?.action;

    // REQUEST PROOF OF DATE
    if (action === "request-date-proof") {
      const { requester_id, confirmer_id, match_id, date_location } = req.body;
      if (!requester_id || !confirmer_id) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: existing } = await supabase.from("date_confirmations")
          .select("*")
          .or(`and(requester_id.eq.${requester_id},confirmer_id.eq.${confirmer_id}),and(requester_id.eq.${confirmer_id},confirmer_id.eq.${requester_id})`)
          .eq("both_confirmed", false)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0 && !existing[0].both_confirmed) {
          return res.status(409).json({ error: "Pending confirmation already exists", pending: existing[0] });
        }

        const { data, error } = await supabase.from("date_confirmations").insert({
          match_id, requester_id, confirmer_id, date_location,
          requester_confirmed: true, confirmer_confirmed: false, both_confirmed: false,
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });

        await supabase.from("notifications").insert({
          user_id: confirmer_id, type: "date_proof_request",
          title: "Date Confirmation Request",
          body: "Someone wants to confirm your date. Tap to verify!",
          data: { date_confirmation_id: data.id, requester_id },
        }).catch(() => {});

        return res.json({ success: true, confirmation: data });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // CONFIRM DATE
    if (action === "confirm-date") {
      const { confirmation_id, confirmer_id } = req.body;
      if (!confirmation_id || !confirmer_id) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: conf } = await supabase.from("date_confirmations").select("*").eq("id", confirmation_id).single();
        if (!conf) return res.status(404).json({ error: "Not found" });
        if (conf.confirmer_id !== confirmer_id && conf.requester_id !== confirmer_id) return res.status(403).json({ error: "Not authorized" });

        const updates = conf.requester_id === confirmer_id
          ? { requester_confirmed: true }
          : { confirmer_confirmed: true };

        const bothConfirmed = (conf.requester_id === confirmer_id ? true : conf.requester_confirmed)
          && (conf.confirmer_id === confirmer_id ? true : conf.confirmer_confirmed);

        if (bothConfirmed) {
          updates.both_confirmed = true;
          updates.confirmed_at = new Date().toISOString();
        }

        await supabase.from("date_confirmations").update(updates).eq("id", confirmation_id);

        if (bothConfirmed) {
          for (const uid of [conf.requester_id, conf.confirmer_id]) {
            const { count } = await supabase.from("date_confirmations")
              .select("*", { count: "exact", head: true })
              .or(`requester_id.eq.${uid},confirmer_id.eq.${uid}`)
              .eq("both_confirmed", true);
            await supabase.from("profiles").update({ verified_dates_count: count || 0 }).eq("user_id", uid);
            await supabase.rpc("calculate_trust_score", { p_user_id: uid }).catch(() => {});
          }
        }

        return res.json({ success: true, both_confirmed: bothConfirmed });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // POST-DATE REVIEW
    if (action === "review-date") {
      const { reviewer_id, reviewed_id, date_confirmation_id, rating, tags } = req.body;
      if (!reviewer_id || !reviewed_id || !rating) return res.status(400).json({ error: "Missing fields" });
      if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });

      try {
        const { error } = await supabase.from("trust_reviews").upsert({
          reviewer_id, reviewed_id, date_confirmation_id,
          rating, tags: tags || [], is_anonymous: true,
        }, { onConflict: "reviewer_id,date_confirmation_id" });

        if (error) return res.status(500).json({ error: error.message });
        await supabase.rpc("calculate_trust_score", { p_user_id: reviewed_id }).catch(() => {});
        return res.json({ success: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // VOUCH FOR SOMEONE
    if (action === "vouch") {
      const { voucher_id, vouched_id, vouch_text, relationship } = req.body;
      if (!voucher_id || !vouched_id) return res.status(400).json({ error: "Missing fields" });
      if (voucher_id === vouched_id) return res.status(400).json({ error: "Cannot vouch for yourself" });

      try {
        const { data: match } = await supabase.from("matches").select("*")
          .or(`and(user1_id.eq.${voucher_id},user2_id.eq.${vouched_id}),and(user1_id.eq.${vouched_id},user2_id.eq.${voucher_id})`)
          .limit(1);

        if (!match || match.length === 0) return res.status(403).json({ error: "You can only vouch for people you matched with" });

        const { error } = await supabase.from("vouches").upsert({
          voucher_id, vouched_id, vouch_text: vouch_text || null,
          relationship: relationship || "met_on_hlove", is_active: true,
        }, { onConflict: "voucher_id,vouched_id" });

        if (error) return res.status(500).json({ error: error.message });

        const { count } = await supabase.from("vouches")
          .select("*", { count: "exact", head: true })
          .eq("vouched_id", vouched_id).eq("is_active", true);

        await supabase.from("profiles").update({ vouch_count: count || 0 }).eq("user_id", vouched_id);
        await supabase.rpc("calculate_trust_score", { p_user_id: vouched_id }).catch(() => {});

        return res.json({ success: true, total_vouches: count });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // GET TRUST PROFILE
    if (action === "trust-profile") {
      const { user_id } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const [
          { data: profile },
          { data: vouches },
          { data: dates },
          { data: reviews },
        ] = await Promise.all([
          supabase.from("profiles").select("trust_score, verified_dates_count, vouch_count").eq("user_id", user_id).single(),
          supabase.from("vouches").select("voucher_id, vouch_text, relationship, created_at").eq("vouched_id", user_id).eq("is_active", true).order("created_at", { ascending: false }).limit(10),
          supabase.from("date_confirmations").select("*").or(`requester_id.eq.${user_id},confirmer_id.eq.${user_id}`).eq("both_confirmed", true).order("confirmed_at", { ascending: false }).limit(10),
          supabase.from("trust_reviews").select("rating, tags, created_at").eq("reviewed_id", user_id).order("created_at", { ascending: false }).limit(20),
        ]);

        const avgRating = reviews && reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null;

        const tagCounts = {};
        reviews?.forEach(r => r.tags?.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));

        return res.json({
          trust_score: profile?.trust_score || 50,
          verified_dates: profile?.verified_dates_count || 0,
          vouch_count: profile?.vouch_count || 0,
          avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          top_tags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag),
          vouches: vouches || [],
          recent_dates: dates?.length || 0,
        });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // GET PENDING DATE CONFIRMATIONS
    if (action === "pending-dates") {
      const { user_id } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const { data } = await supabase.from("date_confirmations")
          .select("*")
          .eq("confirmer_id", user_id)
          .eq("confirmer_confirmed", false)
          .order("created_at", { ascending: false });

        return res.json({ pending: data || [] });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    return res.status(400).json({ error: "Invalid action" });
  }
  