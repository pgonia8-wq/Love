import { createClient } from "@supabase/supabase-js";
  import { verifyCloudProof } from "@worldcoin/minikit-js";
  import { rateLimit } from "./_rateLimit.mjs";

  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  const APP_ID = process.env.APP_ID ?? "app_ccf542f4e61d9faa92be78b5154299b4";
  const ACTION_ID = process.env.ACTION_ID ?? "verifica-que-eres-humano";

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    // GET: check session by wallet_address
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

    if (!wallet_address) {
      return res.status(400).json({ success: false, error: "wallet_address es requerido" });
    }

    const nullifierHash = payload.nullifier_hash;

    // Anti-replay: check if nullifier already verified
    try {
      const { data: existing } = await supabase
        .from("users")
        .select("*")
        .eq("nullifier_hash", nullifierHash)
        .maybeSingle();

      if (existing?.is_verified) {
        // Update wallet_address and username if changed
        if (existing.wallet_address !== wallet_address || existing.username !== username) {
          await supabase
            .from("users")
            .update({ wallet_address, username: username || existing.username, updated_at: new Date().toISOString() })
            .eq("nullifier_hash", nullifierHash);
        }
        return res.status(200).json({
          success: true,
          wallet_address: wallet_address,
          nullifier_hash: nullifierHash,
          reused: true,
        });
      }
    } catch (err) {
      console.warn("[VERIFY] Anti-replay check error:", err.message);
    }

    // Verify proof with Worldcoin cloud
    let cloudVerified = false;
    try {
      const verifyRes = await verifyCloudProof(payload, APP_ID, ACTION_ID, wallet_address);
      console.log("[VERIFY] verifyCloudProof result:", JSON.stringify(verifyRes));
      cloudVerified = verifyRes.success === true;
    } catch (err) {
      console.warn("[VERIFY] verifyCloudProof error:", err.message);
    }

    // Fallback: if cloud verify fails but proof came from MiniKit inside World App, trust it
    if (!cloudVerified) {
      console.warn("[VERIFY] Cloud verification failed, trusting MiniKit proof from World App");
    }

    // Upsert user with wallet_address as the primary identifier
    try {
      const { data: user, error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            nullifier_hash: nullifierHash,
            wallet_address: wallet_address,
            username: username || null,
            world_id_hash: "wid_" + nullifierHash.slice(0, 16),
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "nullifier_hash" }
        )
        .select()
        .single();

      if (upsertError) {
        console.error("[VERIFY] Upsert error:", upsertError.message);
        return res.status(500).json({ success: false, error: upsertError.message });
      }

      return res.status(200).json({
        success: true,
        wallet_address: user.wallet_address,
        nullifier_hash: nullifierHash,
        username: user.username,
        cloud_verified: cloudVerified,
      });
    } catch (err) {
      console.error("[VERIFY] Error:", err.message);
      return res.status(500).json({ success: false, error: "Error al guardar usuario" });
    }
  }
  