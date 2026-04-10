import { createClient } from "@supabase/supabase-js";
  import { rateLimit } from "./_rateLimit.mjs";

  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ success: false });

    if (rateLimit(req, { max: 10, windowMs: 60000 }).limited) {
      return res.status(429).json({ success: false, error: "Too many requests" });
    }

    const { user_id, payment_type, currency, amount, tx_id, event_id } = req.body || {};
    if (!user_id || !payment_type || !currency || !tx_id) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    try {
      const fee = (amount || 0) * 0.15;
      await supabase.from("payments").insert({ user_id, payment_type, currency, amount: amount || 0, platform_fee: fee, tx_id, status: "confirmed" });

      if (payment_type === "subscription") {
        const exp = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
        await supabase.from("users").update({ is_premium: true, premium_expires_at: exp, updated_at: new Date().toISOString() }).eq("wallet_address", user_id);
        await supabase.from("subscriptions").upsert({ user_id, plan: "premium_monthly", currency, amount: amount || 0, started_at: new Date().toISOString(), expires_at: exp, is_active: true, auto_renew: true }, { onConflict: "user_id" });
      }

      if (payment_type === "boost") {
        await supabase.from("profiles").update({ boost_active_until: new Date(Date.now() + 1800000).toISOString() }).eq("user_id", user_id);
      }

      if (payment_type === "event_ticket" && event_id) {
        await supabase.from("event_tickets").insert({ event_id, user_id, payment_currency: currency, payment_amount: amount || 0, payment_tx_id: tx_id });
      }

      return res.status(200).json({ success: true, payment_type });
    } catch (err) {
      console.error("[CONFIRM]", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }
  