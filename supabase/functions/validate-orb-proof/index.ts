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

    if (!nullifier_hash || !proof || !merkle_root) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing verification data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verification_level !== "orb") {
      return new Response(
        JSON.stringify({ success: false, error: "Only Orb verification is accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyRes = await fetch(
      `https://developer.worldcoin.org/api/v1/verify/${app_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkle_root,
          nullifier_hash,
          proof,
          verification_level,
          action,
        }),
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.code === "invalid_proof") {
      return new Response(
        JSON.stringify({
          success: false,
          error: verifyData.detail || "Invalid World ID proof",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("nullifier_hash", nullifier_hash)
      .single();

    if (existingUser) {
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingUser.id);

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
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser,
        isNewUser: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
