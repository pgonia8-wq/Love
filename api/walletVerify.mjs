import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "./_rateLimit.mjs";
import { verifySiweMessage } from "@worldcoin/minikit-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (rateLimit(req, { max: 15, windowMs: 60000 }).limited) {
    return res.status(429).json({ success: false, error: "Demasiadas solicitudes." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { payload, nonce, userId } = body;

  console.log("[WALLET_VERIFY] Received request. userId:", userId, "has payload:", !!payload, "has nonce:", !!nonce);

  if (!payload || typeof payload !== "object") {
    console.error("[WALLET_VERIFY] Missing or invalid payload");
    return res.status(400).json({ success: false, error: "payload es requerido" });
  }
  if (!nonce || typeof nonce !== "string") {
    console.error("[WALLET_VERIFY] Missing nonce");
    return res.status(400).json({ success: false, error: "nonce es requerido" });
  }
  if (!payload.message || !payload.signature || !payload.address) {
    console.error("[WALLET_VERIFY] Incomplete payload. has message:", !!payload.message, "has signature:", !!payload.signature, "has address:", !!payload.address);
    return res.status(400).json({ success: false, error: "payload incompleto (message, signature, address requeridos)" });
  }

  try {
    console.log("[WALLET_VERIFY] Verifying SIWE message with nonce:", nonce.substring(0, 8) + "...");
    const validMessage = await verifySiweMessage(payload, nonce);
    console.log("[WALLET_VERIFY] verifySiweMessage result:", JSON.stringify({ isValid: validMessage.isValid, address: validMessage.siweMessageData?.address }));

    if (!validMessage.isValid) {
      console.error("[WALLET_VERIFY] SIWE signature invalid");
      return res.status(401).json({ success: false, error: "Firma SIWE invalida" });
    }

    const walletAddress = validMessage.siweMessageData?.address || payload.address;
    console.log("[WALLET_VERIFY] Verified wallet address:", walletAddress);

    if (userId) {
      const { error: updateErr } = await supabase
        .from("users")
        .update({ wallet_address: walletAddress, updated_at: new Date().toISOString() })
        .eq("nullifier_hash", userId);

      if (updateErr) {
        console.warn("[WALLET_VERIFY] Update user wallet error:", updateErr.message);
        const { error: updateErr2 } = await supabase
          .from("users")
          .update({ wallet_address: walletAddress, updated_at: new Date().toISOString() })
          .eq("wallet_address", userId);
        if (updateErr2) console.warn("[WALLET_VERIFY] Fallback update also failed:", updateErr2.message);
      } else {
        console.log("[WALLET_VERIFY] Updated user wallet for userId:", userId);
      }
    }

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("wallet_address", walletAddress);

      console.log("[WALLET_VERIFY] Existing user found and updated");
      return res.status(200).json({
        success: true,
        address: walletAddress,
        wallet_address: walletAddress,
        reused: true,
      });
    }

    console.log("[WALLET_VERIFY] No existing user, returning new session");
    return res.status(200).json({
      success: true,
      address: walletAddress,
      wallet_address: walletAddress,
      new_session: true,
    });
  } catch (err) {
    console.error("[WALLET_VERIFY] Error:", err.message, err.stack);
    return res.status(401).json({ success: false, error: "Error de verificacion SIWE: " + err.message });
  }
}
