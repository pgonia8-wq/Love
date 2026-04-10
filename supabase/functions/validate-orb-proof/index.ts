import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: string;
  action: string;
  app_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: VerifyRequest = await req.json();
    const { merkle_root, nullifier_hash, proof, verification_level, action, app_id } = body;

    console.log("[validate-orb-proof] Received request:");
    console.log("[validate-orb-proof] action:", action);
    console.log("[validate-orb-proof] app_id:", app_id);
    console.log("[validate-orb-proof] verification_level:", verification_level);
    console.log("[validate-orb-proof] nullifier_hash:", nullifier_hash?.slice(0, 20) + "...");

    if (!nullifier_hash || !proof || !merkle_root) {
      console.error("[validate-orb-proof] Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing verification data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verification_level !== "orb") {
      console.error("[validate-orb-proof] Wrong verification level:", verification_level);
      return new Response(
        JSON.stringify({ success: false, error: "Only Orb verification is accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyUrl = `https://developer.worldcoin.org/api/v2/verify/${app_id}`;
    console.log("[validate-orb-proof] Calling Worldcoin API:", verifyUrl);

    const verifyBody = {
      merkle_root,
      nullifier_hash,
      proof,
      verification_level,
      action,
    };

    console.log("[validate-orb-proof] Verify body:", JSON.stringify(verifyBody));

    const verifyRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    });

    const verifyData = await verifyRes.json();
    console.log("[validate-orb-proof] Worldcoin API status:", verifyRes.status);
    console.log("[validate-orb-proof] Worldcoin API response:", JSON.stringify(verifyData));

    if (!verifyRes.ok) {
      console.error("[validate-orb-proof] Worldcoin API rejected proof:", verifyData);
      return new Response(
        JSON.stringify({
          success: false,
          error: verifyData.detail || verifyData.message || "Invalid World ID proof",
          worldcoin_error: verifyData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-orb-proof] Proof verified successfully!");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseServiceKey) {
      console.error("[validate-orb-proof] SUPABASE_SERVICE_ROLE_KEY is not set!");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("nullifier_hash", nullifier_hash)
      .single();

    console.log("[validate-orb-proof] User lookup:", existingUser ? "found" : "not found", lookupError?.message || "");

    if (existingUser) {
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingUser.id);

      console.log("[validate-orb-proof] Returning existing user:", existingUser.id);

      return new Response(
        JSON.stringify({
          success: true,
          user: existingUser,
          isNewUser: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const worldIdHash = `wid_${nullifier_hash.slice(0, 16)}`;

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        world_id_hash: worldIdHash,
        nullifier_hash,
        is_verified: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[validate-orb-proof] User insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-orb-proof] Created new user:", newUser.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser,
        isNewUser: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[validate-orb-proof] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
