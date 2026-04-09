import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 0.15;

interface PaymentRequest {
  user_id: string;
  payment_type: "subscription" | "boost" | "superlike" | "see_likes" | "event_ticket";
  currency: "WLD" | "USDC";
  amount: number;
  tx_id: string;
  event_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: PaymentRequest = await req.json();
    const { user_id, payment_type, currency, amount, tx_id, event_id } = body;

    if (!user_id || !payment_type || !currency || !tx_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing payment data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: user } = await supabase
      .from("users")
      .select("id, is_verified")
      .eq("id", user_id)
      .single();

    if (!user || !user.is_verified) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found or not verified" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformFee = amount * PLATFORM_FEE_PERCENT;

    const { error: paymentError } = await supabase.from("payments").insert({
      user_id,
      payment_type,
      currency,
      amount,
      platform_fee: platformFee,
      tx_id,
      status: "confirmed",
    });

    if (paymentError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (payment_type) {
      case "subscription": {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase
          .from("users")
          .update({
            is_premium: true,
            premium_expires_at: expiresAt.toISOString(),
          })
          .eq("id", user_id);

        await supabase.from("subscriptions").upsert(
          {
            user_id,
            plan: "premium_monthly",
            currency,
            amount,
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            auto_renew: true,
          },
          { onConflict: "user_id" }
        );
        break;
      }

      case "boost": {
        const boostUntil = new Date();
        boostUntil.setMinutes(boostUntil.getMinutes() + 30);

        await supabase
          .from("profiles")
          .update({ boost_active_until: boostUntil.toISOString() })
          .eq("user_id", user_id);
        break;
      }

      case "event_ticket": {
        if (!event_id) {
          return new Response(
            JSON.stringify({ success: false, error: "Event ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: event } = await supabase
          .from("events")
          .select("current_attendees, max_attendees")
          .eq("id", event_id)
          .single();

        if (!event || event.current_attendees >= event.max_attendees) {
          return new Response(
            JSON.stringify({ success: false, error: "Event is full" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("event_tickets").insert({
          event_id,
          user_id,
          payment_currency: currency,
          payment_amount: amount,
          payment_tx_id: tx_id,
        });
        break;
      }

      case "superlike":
      case "see_likes":
        break;
    }

    return new Response(
      JSON.stringify({ success: true, payment_type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
