import { createClient } from "@supabase/supabase-js";
  import { rateLimit } from "./_rateLimit.mjs";
  import { verifySiweMessage } from "@worldcoin/minikit-js/siwe";

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_ANON_KEY || "https://vdenlattnqkfurebyyfz.supabase.co",
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

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ success: false, error: "payload es requerido" });
    }
    if (!nonce || typeof nonce !== "string") {
      return res.status(400).json({ success: false, error: "nonce es requerido" });
    }
    if (!payload.message || !payload.signature || !payload.address) {
      return res.status(400).json({ success: false, error: "payload incompleto" });
    }

    try {
      const validMessage = await verifySiweMessage(payload, nonce);

      if (!validMessage.isValid) {
        return res.status(401).json({ success: false, error: "Firma SIWE inválida" });
      }

      const walletAddress = validMessage.siweMessageData?.address || payload.address;

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

        return res.status(200).json({
          success: true,
          wallet_address: walletAddress,
          reused: true,
        });
      }

      return res.status(200).json({
        success: true,
        wallet_address: walletAddress,
        new_session: true,
      });
    } catch (err) {
      console.error("[WALLET_VERIFY] Error:", err.message);
      return res.status(401).json({ success: false, error: "Error de verificación SIWE" });
    }
  }
  