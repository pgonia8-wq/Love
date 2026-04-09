import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  reporter_id: string;
  reported_id: string;
  reason: "spam" | "inappropriate" | "fake" | "harassment" | "underage" | "other";
  details?: string;
}

const BANNED_WORDS = [
  "nsfw",
  "escort",
  "hookup",
  "xxx",
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ReportRequest = await req.json();
    const { reporter_id, reported_id, reason, details } = body;

    if (!reporter_id || !reported_id || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing report data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reporter_id === reported_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot report yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: reportError } = await supabase.from("reports").insert({
      reporter_id,
      reported_id,
      reason,
      details: details || "",
      status: "pending",
    });

    if (reportError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to submit report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: reportCount } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_id", reported_id)
      .eq("status", "pending");

    if (reportCount && (reportCount as any).length >= 5) {
      await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", reported_id);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("bio, display_name")
      .eq("user_id", reported_id)
      .single();

    if (profile) {
      const textToCheck = `${profile.display_name} ${profile.bio}`.toLowerCase();
      const hasBannedContent = BANNED_WORDS.some((word) =>
        textToCheck.includes(word)
      );

      if (hasBannedContent) {
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", reported_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Report submitted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
