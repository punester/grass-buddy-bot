import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authorizationHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.user.id;

    const body = await req.json();
    const { action, phoneNumber, code } = body;

    // Validate inputs
    if (!action || !["send", "check"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid action. Must be 'send' or 'check'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phoneNumber || typeof phoneNumber !== "string" || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number. Must be E.164 format (e.g. +16175551234)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send") {
      // Send verification code
      const twilioRes = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phoneNumber, Channel: "sms" }),
        }
      );

      const twilioBody = await twilioRes.json().catch(() => ({}));

      if (twilioRes.ok) {
        console.log(`Twilio Verify sent successfully for ${userId} to ${phoneNumber}`);
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorMsg = twilioBody.message || "Failed to send verification code";
        console.error(`Twilio Verify send error for ${userId}: status=${twilioRes.status} code=${twilioBody.code} message=${errorMsg} moreInfo=${twilioBody.more_info} serviceSid=${TWILIO_VERIFY_SERVICE_SID?.substring(0,8)}...`);
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "check") {
      if (!code || typeof code !== "string" || !/^\d{4,8}$/.test(code)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid code. Must be 4-8 digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check verification code
      const twilioRes = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phoneNumber, Code: code }),
        }
      );

      const twilioBody = await twilioRes.json().catch(() => ({}));

      if (twilioBody.status === "approved") {
        // Update profile
        await supabase
          .from("profiles")
          .update({
            sms_phone: phoneNumber,
            sms_phone_verified: true,
            sms_opted_in: true,
          } as any)
          .eq("id", userId);

        // Send welcome SMS via send-sms
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId,
              message:
                "Welcome to ThirstyGrass alerts! You'll get daily watering recommendations when your lawn needs action. Reply STOP at any time to unsubscribe.",
              alertType: "OPT_IN_CONFIRM",
            }),
          });
        } catch (e) {
          console.error("Welcome SMS failed (non-blocking):", e);
        }

        return new Response(
          JSON.stringify({ success: true, verified: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, verified: false, error: "Invalid code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-phone error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
