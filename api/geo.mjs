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

    const { action } = req.query || {};

    if (req.method === "POST" && (action === "update-location" || req.body?.action === "update-location")) {
      const { user_id, lat, lng, city, country, country_code } = req.body;
      if (!user_id || lat == null || lng == null) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: profile } = await supabase.from("profiles").select("country, country_set_at").eq("user_id", user_id).single();
        const updates = { location_lat: lat, location_lng: lng, city, last_active_at: new Date().toISOString(), is_online: true };

        if (!profile?.country || !profile?.country_set_at) {
          updates.country = country;
          updates.country_code = country_code;
          updates.country_set_at = new Date().toISOString();
        }

        await supabase.from("profiles").update(updates).eq("user_id", user_id);
        await supabase.from("user_location_history").insert({ user_id, lat, lng, city, country, country_code }).catch(() => {});
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === "POST" && (action === "change-country" || req.body?.action === "change-country")) {
      const { user_id, new_country, new_country_code } = req.body;
      if (!user_id || !new_country) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data: user } = await supabase.from("users").select("is_premium").eq("wallet_address", user_id).single();
        if (!user?.is_premium) return res.status(403).json({ error: "Premium required to change country" });

        const { data: profile } = await supabase.from("profiles").select("country, country_code, country_set_at").eq("user_id", user_id).single();
        if (profile?.country_set_at) {
          const setDate = new Date(profile.country_set_at);
          const oneYearLater = new Date(setDate.getTime() + 365 * 24 * 60 * 60 * 1000);
          if (new Date() < oneYearLater) {
            const daysLeft = Math.ceil((oneYearLater.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            return res.status(403).json({ error: "Cannot change country for " + daysLeft + " more days", days_left: daysLeft });
          }
        }

        await supabase.from("profiles").update({ country: new_country, country_code: new_country_code, country_set_at: new Date().toISOString() }).eq("user_id", user_id);
        await supabase.from("passport_history").insert({
          user_id,
          from_country: profile?.country,
          from_country_code: profile?.country_code,
          to_country: new_country,
          to_country_code: new_country_code,
          next_change_allowed_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }).catch(() => {});

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === "POST" && (action === "travel-mode" || req.body?.action === "travel-mode")) {
      const { user_id, enabled, travel_city, travel_country, travel_country_code, travel_lat, travel_lng } = req.body;
      if (!user_id) return res.status(400).json({ error: "Missing user_id" });

      try {
        const { data: user } = await supabase.from("users").select("is_premium").eq("wallet_address", user_id).single();
        if (!user?.is_premium) return res.status(403).json({ error: "Premium required for Travel Mode" });

        if (enabled) {
          await supabase.from("profiles").update({
            travel_active: true,
            travel_city,
            travel_country,
            travel_country_code,
            travel_lat,
            travel_lng,
            travel_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }).eq("user_id", user_id);
        } else {
          await supabase.from("profiles").update({
            travel_active: false, travel_city: null, travel_country: null,
            travel_country_code: null, travel_lat: null, travel_lng: null, travel_expires_at: null
          }).eq("user_id", user_id);
        }

        return res.json({ success: true, travel_active: !!enabled });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === "POST" && (action === "nearby" || req.body?.action === "nearby")) {
      const { user_id, lat, lng, max_distance_km = 50, gender_filter, age_min = 18, age_max = 99, limit = 50 } = req.body;
      if (!user_id || lat == null || lng == null) return res.status(400).json({ error: "Missing fields" });

      try {
        const { data, error } = await supabase.rpc("get_nearby_profiles", {
          p_user_id: user_id,
          p_lat: lat,
          p_lng: lng,
          p_max_distance_km: max_distance_km,
          p_limit: limit,
          p_gender_filter: gender_filter || null,
          p_age_min: age_min,
          p_age_max: age_max
        });

        if (error) {
          const { data: fallback } = await supabase.from("profiles")
            .select("*")
            .neq("user_id", user_id)
            .eq("is_active", true)
            .limit(limit);
          return res.json({ profiles: fallback || [], fallback: true });
        }

        return res.json({ profiles: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === "POST" && (action === "update-distance" || req.body?.action === "update-distance")) {
      const { user_id, max_distance_km } = req.body;
      if (!user_id || !max_distance_km) return res.status(400).json({ error: "Missing fields" });

      try {
        await supabase.from("profiles").update({ max_distance_km }).eq("user_id", user_id);
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: "Invalid action. Use: update-location, change-country, travel-mode, nearby, update-distance" });
  }
  