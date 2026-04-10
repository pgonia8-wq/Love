import { createClient } from "@supabase/supabase-js";

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
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

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

    try {
      const { data: existing } = await supabase
        .from("users")
        .select("id, is_verified, nullifier_hash")
        .eq("nullifier_hash", nullifierHash)
        .maybeSingle();

      if (existing?.is_verified) {
        return res.status(200).json({ success: true, user: existing, isNewUser: false, reused: true });
      }
    } catch (err) {
      console.warn("[VERIFY] No se pudo verificar anti-replay:", err.message);
    }

    let verifyData;
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

      verifyData = await verifyResponse.json();
      console.log("[VERIFY] Worldcoin status:", verifyResponse.status);
      console.log("[VERIFY] Worldcoin response:", JSON.stringify(verifyData));

      const isSuccess = verifyResponse.ok && (verifyData.success === true || verifyData.success === "true");

      if (!isSuccess) {
        const errMsg = verifyData.detail ?? verifyData.error ?? "";
        if (errMsg.includes("already") || verifyData.code === "already_verified") {
          return res.status(200).json({ success: true, nullifier_hash: nullifierHash, reused: true });
        }
        return res.status(verifyResponse.status || 400).json({
          success: false,
          error: errMsg || "Verificación fallida en Worldcoin",
        });
      }
    } catch (err) {
      console.error("[VERIFY] Error de red al contactar Worldcoin:", err.message);
      return res.status(500).json({ success: false, error: "Error al contactar Worldcoin" });
    }

    try {
      const worldIdHash = `wid_${nullifierHash.slice(0, 16)}`;

      const { data: user, error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            nullifier_hash: nullifierHash,
            world_id_hash: worldIdHash,
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "nullifier_hash" }
        )
        .select()
        .single();

      if (upsertError) {
        console.error("[VERIFY] Error upsert:", upsertError.message);
        return res.status(500).json({ success: false, error: upsertError.message });
      }

      return res.status(200).json({ success: true, user, nullifier_hash: nullifierHash });
    } catch (err) {
      console.error("[VERIFY] Error:", err.message);
      return res.status(500).json({ success: false, error: "Error al guardar usuario" });
    }
  }
  