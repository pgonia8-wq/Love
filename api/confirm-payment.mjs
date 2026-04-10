import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "./_rateLimit.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const APP_ID = process.env.APP_ID || "app_ccf542f4e61d9faa92be78b5154299b4";

async function verifyTransaction(transactionId) {
  console.log("[CONFIRM] Verifying tx with World App API:", transactionId);
  try {
    const url = `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${APP_ID}`;
    console.log("[CONFIRM] Calling:", url);
    const res = await fetch(url);
    console.log("[CONFIRM] World API response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[CONFIRM] World API error response:", text);
      return { verified: false, error: "World API returned " + res.status };
    }

    const data = await res.json();
    console.log("[CONFIRM] World API response:", JSON.stringify(data));

    if (data.reference && data.status === "mined") {
      console.log("[CONFIRM] Transaction verified OK. reference:", data.reference, "status:", data.status);
      return {
        verified: true,
        reference: data.reference,
        status: data.status,
        transaction_hash: data.transaction_hash,
        from_address: data.from_address,
        to_address: data.to_address,
        token: data.input_token,
        amount: data.input_token_amount,
      };
    }

    if (data.status === "pending") {
      console.log("[CONFIRM] Transaction still pending, accepting provisionally");
      return {
        verified: true,
        reference: data.reference,
        status: data.status,
        pending: true,
      };
    }

    console.error("[CONFIRM] Transaction not verified. status:", data.status);
    return { verified: false, error: "Transaction status: " + (data.status || "unknown") };
  } catch (err) {
    console.error("[CONFIRM] verifyTransaction exception:", err.message);
    return { verified: false, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false });

  if (rateLimit(req, { max: 10, windowMs: 60000 }).limited) {
    return res.status(429).json({ success: false, error: "Too many requests" });
  }

  const { user_id, payment_type, currency, amount, tx_id, reference, event_id } = req.body || {};
  console.log("[CONFIRM] Received:", JSON.stringify({ user_id, payment_type, currency, amount, tx_id, reference, event_id }));

  if (!user_id || !payment_type || !currency || !tx_id) {
    console.error("[CONFIRM] Missing required fields");
    return res.status(400).json({ success: false, error: "Missing fields (user_id, payment_type, currency, tx_id)" });
  }

  try {
    const txVerification = await verifyTransaction(tx_id);

    if (!txVerification.verified) {
      console.error("[CONFIRM] Transaction verification FAILED:", txVerification.error);
      return res.status(400).json({
        success: false,
        error: "Payment not verified: " + txVerification.error,
        tx_status: txVerification,
      });
    }

    if (reference && txVerification.reference && txVerification.reference !== reference) {
      console.error("[CONFIRM] Reference mismatch! sent:", reference, "got:", txVerification.reference);
      return res.status(400).json({
        success: false,
        error: "Payment reference mismatch",
      });
    }

    console.log("[CONFIRM] Transaction verified. Proceeding with:", payment_type);

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("tx_id", tx_id)
      .maybeSingle();

    if (existingPayment) {
      console.warn("[CONFIRM] Duplicate tx_id detected:", tx_id);
      return res.status(400).json({ success: false, error: "Payment already processed" });
    }

    const fee = (amount || 0) * 0.15;
    const { error: paymentErr } = await supabase.from("payments").insert({
      user_id,
      payment_type,
      currency,
      amount: amount || 0,
      platform_fee: fee,
      tx_id,
      reference: reference || null,
      status: txVerification.pending ? "pending" : "confirmed",
      tx_hash: txVerification.transaction_hash || null,
      verified_at: new Date().toISOString(),
    });

    if (paymentErr) {
      console.error("[CONFIRM] Payment insert error:", paymentErr.message);
    }

    if (payment_type === "subscription") {
      const exp = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
      console.log("[CONFIRM] Activating premium for user:", user_id, "expires:", exp);

      const { error: userErr } = await supabase.from("users")
        .update({ is_premium: true, premium_expires_at: exp, updated_at: new Date().toISOString() })
        .or(`wallet_address.eq.${user_id},nullifier_hash.eq.${user_id}`);

      if (userErr) console.error("[CONFIRM] User update error:", userErr.message);

      const { error: subErr } = await supabase.from("subscriptions").upsert({
        user_id,
        plan: "premium_monthly",
        currency,
        amount: amount || 0,
        started_at: new Date().toISOString(),
        expires_at: exp,
        is_active: true,
        auto_renew: true,
      }, { onConflict: "user_id" });

      if (subErr) console.error("[CONFIRM] Subscription upsert error:", subErr.message);
    }

    if (payment_type === "boost") {
      console.log("[CONFIRM] Activating boost for user:", user_id);
      await supabase.from("profiles")
        .update({ boost_active_until: new Date(Date.now() + 1800000).toISOString() })
        .eq("user_id", user_id);
    }

    if (payment_type === "event_ticket" && event_id) {
      console.log("[CONFIRM] Creating event ticket for event:", event_id);
      await supabase.from("event_tickets").insert({
        event_id,
        user_id,
        payment_currency: currency,
        payment_amount: amount || 0,
        payment_tx_id: tx_id,
      });
    }

    console.log("[CONFIRM] Payment processed successfully:", payment_type);
    return res.status(200).json({
      success: true,
      payment_type,
      tx_verified: true,
      tx_status: txVerification.status,
    });
  } catch (err) {
    console.error("[CONFIRM] Exception:", err.message, err.stack);
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
}
