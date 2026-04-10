import { createClient } from "@supabase/supabase-js";
  import { rateLimit } from "./_rateLimit.mjs";
  import { verifySiweMessage } from "@worldcoin/minikit-js";

  if (!process.env.SUPABASE_URL) console.error("[WALLET_VERIFY] SUPABASE_URL no configurada");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error("[WALLET_VERIFY] SUPABASE_SERVICE_ROLE_KEY no configurada");

  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
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
    } catch (err) {
      console.error("[WALLET_VERIFY] verifySiweMessage error:", err.message);
      return res.status(401).json({ success: false, error: "Error verificando firma SIWE: " + err.message });
    }

    const verifiedAddress = payload.address;

    return res.status(200).json({
      success: true,
      address: verifiedAddress,
    });
  }
  