import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    const body = await req.json();
    const {
      referral_code,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      device_fingerprint, user_agent,
    } = body;

    // Save UTM fields to profile
    const utmUpdate: Record<string, string | null> = {};
    if (utm_source) utmUpdate.utm_source = utm_source;
    if (utm_medium) utmUpdate.utm_medium = utm_medium;
    if (utm_campaign) utmUpdate.utm_campaign = utm_campaign;
    if (utm_content) utmUpdate.utm_content = utm_content;
    if (utm_term) utmUpdate.utm_term = utm_term;

    if (Object.keys(utmUpdate).length > 0) {
      await supabase.from("profiles").update(utmUpdate).eq("id", user.id);
    }

    // If no referral code, we're done
    if (!referral_code) {
      return new Response(JSON.stringify({ ok: true, referral: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("referral_code", referral_code)
      .single();

    if (!referrer) {
      console.log("[process-referral] Invalid referral code:", referral_code);
      return new Response(JSON.stringify({ ok: true, referral: false, reason: "invalid_code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Self-referral check
    if (referrer.id === user.id || referrer.email === user.email) {
      console.log("[process-referral] Self-referral blocked");
      return new Response(JSON.stringify({ ok: true, referral: false, reason: "self_referral" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fraud detection
    const referredIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const referredDevice = device_fingerprint || "unknown";
    const referredBrowser = user_agent || "unknown";

    // Get referrer's auth metadata for comparison
    const { data: referrerAuth } = await supabase.auth.admin.getUserById(referrer.id);
    const referrerMeta = referrerAuth?.user?.user_metadata || {};
    const referrerIp = referrerAuth?.user?.last_sign_in_at ? "unknown" : "unknown"; // IP not reliably stored
    const referrerDevice = referrerMeta.device_fingerprint || "unknown";
    const referrerBrowser = referrerMeta.user_agent || "unknown";

    const ipMatch = referredIp !== "unknown" && referredIp === referrerIp;
    const deviceMatch = referredDevice !== "unknown" && referredDevice === referrerDevice;
    const browserMatch = referredBrowser !== "unknown" && referredBrowser === referrerBrowser;

    const matchCount = [ipMatch, deviceMatch, browserMatch].filter(Boolean).length;
    const fraudSuspected = matchCount >= 2;

    const fraudEvidence = {
      ip_match: ipMatch,
      device_match: deviceMatch,
      browser_match: browserMatch,
      referred_ip: referredIp,
      referrer_ip: referrerIp,
      referred_device: referredDevice,
      referrer_device: referrerDevice,
    };

    // Update referred_by on profile
    await supabase
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", user.id);

    // Insert referral record
    await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      fraud_suspected: fraudSuspected,
      fraud_evidence: fraudEvidence,
      counted: !fraudSuspected,
    });

    // Auto-upgrade check
    const { data: upgraded } = await supabase.rpc("check_and_upgrade_referrer", {
      p_referrer_id: referrer.id,
    });

    console.log(`[process-referral] Referral recorded. Fraud: ${fraudSuspected}. Upgrade: ${upgraded}`);

    return new Response(JSON.stringify({ ok: true, referral: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-referral] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
