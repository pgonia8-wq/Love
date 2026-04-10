import { createClient } from "@supabase/supabase-js";
  import { verifyCloudProof } from "@worldcoin/minikit-js";
  import { rateLimit } from "./_rateLimit.mjs";

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_ANON_KEY || "https://vdenlattnqkfurebyyfz.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const APP_ID = process.env.APP_ID || "app_ccf542f4e61d9faa92be78b5154299b4";
  const ACTION_ID = process.env.ACTION_ID || "verifica-que-eres-humano";

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method === "GET") {
      const wallet = req.query?.wallet;
      if (!wallet) return res.status(400).json({ valid: false });
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("wallet_address", wallet)
          .maybeSingle();
        return res.status(200).json({
          valid: !!data?.is_verified,
          user: data,
          wallet_address: data?.wallet_address,
        });
      } catch (err) {
        return res.status(200).json({ valid: false });
      }
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (rateLimit(req, { max: 10, windowMs: 60000 }).limited) {
      return res.status(429).json({ success: false, error: "Demasiadas solicitudes." });
    }

    const body = req.body || {};
    const { payload, wallet_address, username } = body;

    if (!payload || !payload.nullifier_hash || !payload.proof || !payload.merkle_root) {
      return res.status(400).json({ success: false, error: "Faltan campos en proof" });
    }

    if (payload.verification_level !== "orb") {
      return res.status(400).json({ success: false, error: "Solo se acepta verificación Orb" });
    }

    const userWallet = wallet_address || payload.nullifier_hash;
    const nullifierHash = payload.nullifier_hash;

    try {
      const { data: existing } = await supabase
        .from("users")
        .select("*")
        .eq("nullifier_hash", nullifierHash)
        .maybeSingle();

      if (existing?.is_verified) {
        if (wallet_address && existing.wallet_address !== wallet_address) {
          await supabase
            .from("users")
            .update({ wallet_address: userWallet, username: username || existing.username, updated_at: new Date().toISOString() })
            .eq("nullifier_hash", nullifierHash);
        }
        return res.status(200).json({
          success: true,
          wallet_address: existing.wallet_address,
          nullifier_hash: nullifierHash,
          reused: true,
        });
      }
    } catch (err) {
      console.warn("[VERIFY] Anti-replay check error:", err);
    }

    try {
      const verifyResult = await verifyCloudProof(payload, APP_ID, ACTION_ID);
      if (!verifyResult?.success) {
        return res.status(400).json({ success: false, error: "World ID proof inválido", details: verifyResult });
      }
    } catch (err) {
      console.error("[VERIFY] Cloud proof error:", err);
      return res.status(500).json({ success: false, error: "Error verificando proof" });
    }

    try {
      const { data: newUser, error: insertErr } = await supabase
        .from("users")
        .upsert({
          wallet_address: userWallet,
          nullifier_hash: nullifierHash,
          username: username || null,
          is_verified: true,
          verification_level: "orb",
          updated_at: new Date().toISOString(),
        }, { onConflict: "wallet_address" })
        .select()
        .single();

      if (insertErr) {
        console.error("[VERIFY] Upsert error:", insertErr);
        return res.status(500).json({ success: false, error: "Error creando usuario" });
      }

      return res.status(200).json({
        success: true,
        wallet_address: newUser.wallet_address,
        nullifier_hash: nullifierHash,
        new_user: true,
      });
    } catch (err) {
      console.error("[VERIFY] Error:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }
  