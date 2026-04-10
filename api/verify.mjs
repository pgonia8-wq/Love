import { createClient } from "@supabase/supabase-js";
import { verifyCloudProof } from "@worldcoin/minikit-js";
import { rateLimit } from "./_rateLimit.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
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
    console.log("[VERIFY GET] wallet param:", wallet);
    if (!wallet) return res.status(400).json({ valid: false, error: "Missing wallet param" });
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`wallet_address.eq.${wallet},nullifier_hash.eq.${wallet}`)
        .maybeSingle();

      console.log("[VERIFY GET] found user:", !!data, "is_verified:", data?.is_verified, "error:", error?.message);

      return res.status(200).json({
        valid: !!data?.is_verified,
        user: data,
        wallet_address: data?.wallet_address,
        nullifier_hash: data?.nullifier_hash,
      });
    } catch (err) {
      console.error("[VERIFY GET] Exception:", err.message);
      return res.status(200).json({ valid: false, error: err.message });
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

  console.log("[VERIFY POST] payload keys:", Object.keys(payload || {}));
  console.log("[VERIFY POST] wallet_address:", wallet_address);
  console.log("[VERIFY POST] username:", username);

  if (!payload) {
    console.error("[VERIFY POST] Missing payload entirely");
    return res.status(400).json({ success: false, error: "Missing payload" });
  }

  if (!payload.nullifier_hash || !payload.proof || !payload.merkle_root) {
    console.error("[VERIFY POST] Missing fields:", {
      has_nullifier: !!payload.nullifier_hash,
      has_proof: !!payload.proof,
      has_merkle: !!payload.merkle_root,
      verification_level: payload.verification_level,
    });
    return res.status(400).json({ success: false, error: "Faltan campos en proof" });
  }

  if (payload.verification_level !== "orb") {
    console.error("[VERIFY POST] Wrong verification_level:", payload.verification_level);
    return res.status(400).json({ success: false, error: "Solo se acepta verificacion Orb" });
  }

  const nullifierHash = payload.nullifier_hash;
  const userWallet = wallet_address || nullifierHash;

  console.log("[VERIFY POST] nullifierHash:", nullifierHash);
  console.log("[VERIFY POST] resolved userWallet:", userWallet);

  try {
    const { data: existing, error: lookupErr } = await supabase
      .from("users")
      .select("*")
      .eq("nullifier_hash", nullifierHash)
      .maybeSingle();

    console.log("[VERIFY POST] existing user lookup:", !!existing, "error:", lookupErr?.message);

    if (existing?.is_verified) {
      const updates = { updated_at: new Date().toISOString() };
      if (wallet_address && wallet_address !== existing.wallet_address) {
        updates.wallet_address = wallet_address;
      }
      if (username && username !== existing.username) {
        updates.username = username;
      }

      if (Object.keys(updates).length > 1) {
        await supabase.from("users").update(updates).eq("nullifier_hash", nullifierHash);
        console.log("[VERIFY POST] Updated existing user fields");
      }

      console.log("[VERIFY POST] Returning existing verified user:", existing.wallet_address);
      return res.status(200).json({
        success: true,
        wallet_address: wallet_address || existing.wallet_address,
        nullifier_hash: nullifierHash,
        reused: true,
      });
    }
  } catch (err) {
    console.warn("[VERIFY POST] Anti-replay check error:", err.message);
  }

  try {
    console.log("[VERIFY POST] Calling verifyCloudProof APP_ID:", APP_ID, "ACTION:", ACTION_ID);
    const verifyResult = await verifyCloudProof(payload, APP_ID, ACTION_ID);
    console.log("[VERIFY POST] verifyCloudProof result:", JSON.stringify(verifyResult));

    if (!verifyResult?.success) {
      console.error("[VERIFY POST] Cloud proof FAILED:", JSON.stringify(verifyResult));
      return res.status(400).json({
        success: false,
        error: verifyResult?.detail || "World ID proof invalido",
        code: verifyResult?.code,
        details: verifyResult,
      });
    }
    console.log("[VERIFY POST] Cloud proof verified OK");
  } catch (err) {
    console.error("[VERIFY POST] verifyCloudProof exception:", err.message);
    return res.status(500).json({ success: false, error: "Error verificando proof: " + err.message });
  }

  try {
    const { data: newUser, error: insertErr } = await supabase
      .from("users")
      .upsert(
        {
          wallet_address: userWallet,
          nullifier_hash: nullifierHash,
          username: username || null,
          is_verified: true,
          verification_level: "orb",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "nullifier_hash" }
      )
      .select()
      .single();

    if (insertErr) {
      console.error("[VERIFY POST] Upsert error:", insertErr.message, insertErr.details);
      return res.status(500).json({ success: false, error: "Error creando usuario: " + insertErr.message });
    }

    console.log("[VERIFY POST] User upserted OK, id:", newUser.id, "wallet:", newUser.wallet_address);
    return res.status(200).json({
      success: true,
      wallet_address: newUser.wallet_address,
      nullifier_hash: nullifierHash,
      new_user: true,
    });
  } catch (err) {
    console.error("[VERIFY POST] Final error:", err.message);
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
}
