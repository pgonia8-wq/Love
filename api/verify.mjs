import { createClient } from "@supabase/supabase-js";

  if (!process.env.SUPABASE_URL) console.error("[VERIFY] SUPABASE_URL no configurada");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error("[VERIFY] SUPABASE_SERVICE_ROLE_KEY no configurada");

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
    const { payload, nonce } = body;

    console.log("[VERIFY] payload keys:", Object.keys(payload || {}));
    console.log("[VERIFY] nonce:", nonce);

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

    if (!nonce) {
      return res.status(400).json({ success: false, error: "Nonce requerido" });
    }

    const nullifierHash = payload.nullifier_hash;

    // Validar nonce
    try {
      const { data: nonceRow } = await supabase
        .from("nonces")
        .select("*")
        .eq("nonce", nonce)
        .eq("used", false)
        .maybeSingle();

      if (!nonceRow) {
        console.warn("[VERIFY] Nonce inválido o ya usado:", nonce);
        return res.status(400).json({ success: false, error: "Nonce inválido o expirado" });
      }

      if (new Date(nonceRow.expires_at) < new Date()) {
        return res.status(400).json({ success: false, error: "Nonce expirado" });
      }

      await supabase.from("nonces").update({ used: true }).eq("nonce", nonce);
    } catch (err) {
      console.warn("[VERIFY] Error validando nonce:", err.message);
    }

    // Anti-replay
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
      console.warn("[VERIFY] Anti-replay check error:", err.message);
    }

    // Verificar con World ID v4 API
    let verifyData;
    try {
      const verifyBody = {
        nonce: nonce,
        action: ACTION_ID,
        proof: payload.proof,
        merkle_root: payload.merkle_root,
        nullifier_hash: nullifierHash,
        verification_level: payload.verification_level,
      };

      console.log("[VERIFY] Calling World ID v4...");
      console.log("[VERIFY] URL:", `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`);
      console.log("[VERIFY] Body:", JSON.stringify(verifyBody));

      const verifyResponse = await fetch(
        `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(verifyBody),
        }
      );

      verifyData = await verifyResponse.json();
      console.log("[VERIFY] World ID status:", verifyResponse.status);
      console.log("[VERIFY] World ID response:", JSON.stringify(verifyData));

      const isSuccess = verifyResponse.ok && (verifyData.success === true || verifyData.success === "true");

      if (!isSuccess) {
        const errMsg = verifyData.detail ?? verifyData.error ?? "";
        if (errMsg.includes("already") || verifyData.code === "already_verified") {
          const { data: existingUser } = await supabase
            .from("users")
            .select("*")
            .eq("nullifier_hash", nullifierHash)
            .maybeSingle();
          return res.status(200).json({ success: true, user: existingUser, nullifier_hash: nullifierHash, reused: true });
        }
        return res.status(verifyResponse.status || 400).json({
          success: false,
          error: errMsg || "Verificación fallida",
          worldid_response: verifyData,
        });
      }
    } catch (err) {
      console.error("[VERIFY] Error de red:", err.message);
      return res.status(500).json({ success: false, error: "Error al contactar World ID" });
    }

    // Guardar usuario
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
        console.error("[VERIFY] Upsert error:", upsertError.message);
        return res.status(500).json({ success: false, error: upsertError.message });
      }

      return res.status(200).json({ success: true, user, nullifier_hash: nullifierHash, isNewUser: true });
    } catch (err) {
      console.error("[VERIFY] Error:", err.message);
      return res.status(500).json({ success: false, error: "Error al guardar usuario" });
    }
  }
  