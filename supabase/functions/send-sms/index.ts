import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, message, alertType } = await req.json();

    if (!userId || !message || !alertType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, message, alertType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("sms_phone, sms_opted_in, sms_phone_verified, sms_last_sent_at")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Profile not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard checks
    if (!profile.sms_opted_in) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "SMS not opted in" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.sms_phone_verified) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Phone not verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.sms_phone) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Throttle: 20-hour cooldown
    if (profile.sms_last_sent_at) {
      const lastSent = new Date(profile.sms_last_sent_at);
      const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 20) {
        return new Response(
          JSON.stringify({ status: "skipped", reason: `Throttled — last sent ${Math.round(hoursSince)}h ago` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Call Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: profile.sms_phone,
        Body: message,
      }),
    });

    const twilioBody = await twilioRes.json().catch(() => ({}));

    if (twilioRes.ok) {
      // Log success
      await supabase.from("sms_logs").insert({
        user_id: userId,
        message_body: message,
        alert_type: alertType,
        status: "sent",
        twilio_sid: twilioBody.sid || null,
      });

      // Update last sent timestamp
      await supabase
        .from("profiles")
        .update({ sms_last_sent_at: new Date().toISOString() } as any)
        .eq("id", userId);

      return new Response(
        JSON.stringify({ status: "sent", twilio_sid: twilioBody.sid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = twilioBody.message || JSON.stringify(twilioBody);
      console.error(`Twilio error for user ${userId}: ${errorMsg}`);

      // Log failure
      await supabase.from("sms_logs").insert({
        user_id: userId,
        message_body: message,
        alert_type: alertType,
        status: "failed",
        error_message: errorMsg,
      });

      return new Response(
        JSON.stringify({ status: "failed", error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
