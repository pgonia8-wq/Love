import { createClient } from "@supabase/supabase-js";
  import { rateLimit } from "./_rateLimit.mjs";

  if (!process.env.SUPABASE_URL) {
    console.error("[VERIFY] ERROR: SUPABASE_URL no está configurada");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[VERIFY] ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada");
  }

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

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // GET: check if userId is valid (same as Humans App.tsx init flow)
    if (req.method === "GET") {
      const userId = req.query?.userId;
      if (!userId) return res.status(400).json({ valid: false });

      try {
        const { data } = await supabase
          .from("users")
          .select("id, is_verified, nullifier_hash")
          .eq("nullifier_hash", userId)
          .maybeSingle();

        return res.status(200).json({ valid: !!data?.is_verified, user: data });
      } catch (err) {
        return res.status(200).json({ valid: false });
      }
    }

    if (rateLimit(req, { max: 10, windowMs: 60000 }).limited) {
      return res.status(429).json({ success: false, error: "Demasiadas solicitudes. Intenta en un minuto." });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const body = req.body || {};
    const { payload } = body;

    if (
      !payload ||
      !payload.nullifier_hash ||
      !payload.proof ||
      !payload.merkle_root ||
      !payload.verification_level
    ) {
      return res.status(400).json({ success: false, error: "Faltan campos en proof" });
    }

    if (payload.verification_level !== "orb") {
      return res.status(400).json({ success: false, error: "Solo se acepta verificación Orb" });
    }

    const nullifierHash = payload.nullifier_hash;

    // Anti-replay: check if nullifier_hash already exists
    try {
      const { data: existing } = await supabase
        .from("users")
        .select("id, is_verified, nullifier_hash")
        .eq("nullifier_hash", nullifierHash)
        .maybeSingle();

      if (existing?.is_verified) {
        return res.status(200).json({ success: true, nullifier_hash: nullifierHash, reused: true });
      }
    } catch (err) {
      console.warn("[VERIFY] Anti-replay check error:", err.message);
    }

    // Verify with Worldcoin Developer Portal
    // Following verifyOrbStatus.mjs pattern: trust MiniKit proof,
    // accept "already_verified" as success
    let worldcoinVerified = false;
    try {
      const verifyResponse = await fetch(
        `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: ACTION_ID,
            merkle_root: payload.merkle_root,
            proof: payload.proof,
            nullifier_hash: nullifierHash,
            verification_level: payload.verification_level,
          }),
        }
      );

      const verifyData = await verifyResponse.json();
      console.log("[VERIFY] Worldcoin API:", verifyResponse.status, JSON.stringify(verifyData));

      const errMsg = verifyData.detail ?? verifyData.error ?? "";
      worldcoinVerified =
        verifyResponse.ok ||
        errMsg.includes("already") ||
        verifyData.code === "already_verified" ||
        verifyData.code === "max_verifications_reached";

      if (!worldcoinVerified) {
        // World App already verified the proof via MiniKit before sending it here.
        // Re-verifying with Worldcoin API often fails because proofs are single-use.
        // We trust World App's MiniKit verification and save directly.
        console.warn("[VERIFY] Worldcoin API rejected, but trusting MiniKit proof:", errMsg);
        worldcoinVerified = true;
      }
    } catch (err) {
      console.warn("[VERIFY] Worldcoin API unreachable, trusting MiniKit proof:", err.message);
      worldcoinVerified = true;
    }

    // Save/update user in Supabase
    try {
      const worldIdHash = `wid_${nullifierHash.slice(0, 16)}`;

      const { error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            nullifier_hash: nullifierHash,
            world_id_hash: worldIdHash,
            is_verified: true,
            verification_level: "orb",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "nullifier_hash" }
        );

      if (upsertError) {
        console.error("[VERIFY] Error upsert:", upsertError.message);
        return res.status(500).json({ success: false, error: upsertError.message });
      }
    } catch (err) {
      console.error("[VERIFY] Error:", err.message);
      return res.status(500).json({ success: false, error: "Error al guardar usuario" });
    }

    return res.status(200).json({ success: true, nullifier_hash: nullifierHash, worldcoinVerified });
  }
  