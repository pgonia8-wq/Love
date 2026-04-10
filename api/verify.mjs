import { createClient } from "@supabase/supabase-js";

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

    try {
      const { payload, action, app_id } = req.body;

      console.log("[verify] action:", action, "app_id:", app_id);

      if (!payload || !payload.nullifier_hash || !payload.proof || !payload.merkle_root) {
        return res.status(400).json({ success: false, error: "Missing verification data" });
      }

      if (payload.verification_level !== "orb") {
        return res.status(400).json({ success: false, error: "Only Orb verification accepted" });
      }

      const verifyRes = await fetch(
        `https://developer.worldcoin.org/api/v2/verify/${app_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nullifier_hash: payload.nullifier_hash,
            merkle_root: payload.merkle_root,
            proof: payload.proof,
            verification_level: payload.verification_level,
            action,
          }),
        }
      );

      const verifyData = await verifyRes.json();
      console.log("[verify] Worldcoin:", verifyRes.status, JSON.stringify(verifyData));

      if (!verifyRes.ok) {
        return res.status(400).json({
          success: false,
          error: verifyData.detail || verifyData.message || "Invalid proof",
        });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseServiceKey) {
        return res.status(500).json({ success: false, error: "Server config error" });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const nullifierHash = payload.nullifier_hash;

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("nullifier_hash", nullifierHash)
        .single();

      if (existingUser) {
        await supabase
          .from("users")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existingUser.id);

        return res.status(200).json({ success: true, user: existingUser, isNewUser: false });
      }

      const worldIdHash = `wid_${nullifierHash.slice(0, 16)}`;

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({ world_id_hash: worldIdHash, nullifier_hash: nullifierHash, is_verified: true })
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({ success: false, error: "Failed to create user: " + insertError.message });
      }

      return res.status(200).json({ success: true, user: newUser, isNewUser: true });
    } catch (err) {
      console.error("[verify] Error:", err);
      return res.status(500).json({ success: false, error: "Internal error: " + err.message });
    }
  }
  