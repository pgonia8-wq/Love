import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { payload, action, app_id } = body;

    console.log("[validate-orb-proof] action:", action);
    console.log("[validate-orb-proof] app_id:", app_id);
    console.log("[validate-orb-proof] payload keys:", Object.keys(payload || {}));

    if (!payload || !payload.nullifier_hash || !payload.proof || !payload.merkle_root) {
      console.error("[validate-orb-proof] Missing fields in payload");
      return new Response(
        JSON.stringify({ success: false, error: "Missing verification data in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.verification_level !== "orb") {
      console.error("[validate-orb-proof] Not orb level:", payload.verification_level);
      return new Response(
        JSON.stringify({ success: false, error: "Only Orb verification is accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyUrl = `https://developer.worldcoin.org/api/v2/verify/${app_id}`;
    console.log("[validate-orb-proof] Calling:", verifyUrl);

    const verifyRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nullifier_hash: payload.nullifier_hash,
        merkle_root: payload.merkle_root,
        proof: payload.proof,
        verification_level: payload.verification_level,
        action,
      }),
    });

    const verifyData = await verifyRes.json();
    console.log("[validate-orb-proof] Worldcoin status:", verifyRes.status);
    console.log("[validate-orb-proof] Worldcoin response:", JSON.stringify(verifyData));

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: verifyData.detail || verifyData.message || "Invalid World ID proof",
          worldcoin_response: verifyData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseServiceKey) {
      console.error("[validate-orb-proof] SUPABASE_SERVICE_ROLE_KEY not set!");
      return new Response(
        JSON.stringify({ success: false, error: "Server config error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      console.log("[validate-orb-proof] Returning existing user:", existingUser.id);
      return new Response(
        JSON.stringify({ success: true, user: existingUser, isNewUser: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const worldIdHash = `wid_${nullifierHash.slice(0, 16)}`;

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        world_id_hash: worldIdHash,
        nullifier_hash: nullifierHash,
        is_verified: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[validate-orb-proof] Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-orb-proof] New user created:", newUser.id);
    return new Response(
      JSON.stringify({ success: true, user: newUser, isNewUser: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[validate-orb-proof] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
