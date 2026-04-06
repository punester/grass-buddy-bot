import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE_BUCKETS: Record<string, string[]> = {
  ET: [
    "America/New_York",
    "America/Detroit",
    "America/Indiana/Indianapolis",
    "America/Kentucky/Louisville",
    "America/Toronto",
  ],
  CT: [
    "America/Chicago",
    "America/Menominee",
    "America/Indiana/Knox",
    "America/Winnipeg",
  ],
  MT: [
    "America/Denver",
    "America/Boise",
    "America/Phoenix",
    "America/Edmonton",
  ],
  PT: [
    "America/Los_Angeles",
    "America/Vancouver",
    "America/Anchorage",
    "Pacific/Honolulu",
  ],
};

const SMS_TEMPLATES: Record<string, string> = {
  WATER:
    "🌿 ThirstyGrass: Time to water today. ET demand is outpacing rainfall — check your dashboard for run time. {shortlink}",
  MONITOR:
    "🌿 ThirstyGrass: Borderline today. Check conditions before running your system. {shortlink}",
  SKIP:
    "🌿 ThirstyGrass: Skip watering today — recent rain has your lawn covered. {shortlink}",
  FROST_INCOMING:
    "⚠️ ThirstyGrass: Frost alert — temps dropping below freezing within 48hrs. Hold off watering. {shortlink}",
  DORMANCY_START:
    "🌿 ThirstyGrass: Your lawn is entering dormancy. Pause watering — we'll alert you when spring arrives. {shortlink}",
  DORMANCY_END:
    "🌿 ThirstyGrass: Your lawn is waking up. Spring watering season begins — check your dashboard. {shortlink}",
};

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createShortLink(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("short_links").insert({
      code,
      destination_url: "https://thirstygrass.com/dashboard",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!error) {
      return `https://thirstygrass.com/r/${code}`;
    }
    // unique constraint violation → retry
    if (error.code !== "23505") {
      throw new Error(`short_links insert error: ${error.message}`);
    }
  }
  throw new Error("Failed to generate unique short link after 10 attempts");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { timezone_group } = await req.json();
    const timezones = TIMEZONE_BUCKETS[timezone_group];

    if (!timezones) {
      return new Response(
        JSON.stringify({ error: `Invalid timezone_group: ${timezone_group}. Must be ET, CT, MT, or PT.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query qualifying users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, timezone, last_recommendation, sms_last_sent_at")
      .eq("tier", "paid")
      .eq("sms_opted_in", true)
      .eq("sms_phone_verified", true)
      .not("sms_phone", "is", null)
      .in("timezone", timezones)
      .or("sms_last_sent_at.is.null,sms_last_sent_at.lt." + new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());

    if (usersError) {
      throw new Error(`Query error: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: `No qualifying users for ${timezone_group}`, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`dispatch-sms [${timezone_group}]: ${users.length} qualifying users`);

    const results: Array<{ userId: string; status: string; reason?: string }> = [];

    for (const user of users) {
      try {
        // Step 1 — Get recommendation
        const recResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/calculate-recommendation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ userId: user.id }),
          }
        );

        if (!recResponse.ok) {
          const errText = await recResponse.text();
          console.error(`calculate-recommendation failed for ${user.id}: ${errText}`);
          results.push({ userId: user.id, status: "error", reason: `recommendation failed: ${recResponse.status}` });
          continue;
        }

        const result = await recResponse.json();

        // Step 2 — Send decision
        // Dormant with no seasonal alert → skip
        if (result.isDormant && !result.alertType) {
          await supabase.from("sms_logs").insert({
            user_id: user.id,
            message_body: "",
            alert_type: result.recommendation || "DORMANT",
            status: "skipped",
            error_message: "dormant no alert",
          });
          results.push({ userId: user.id, status: "skipped", reason: "dormant no alert" });
          continue;
        }

        const alertType = result.alertType;

        // Always-send alert types
        const alwaysSend = ["WATER", "FROST_INCOMING", "DORMANCY_START", "DORMANCY_END"];

        if (!alwaysSend.includes(alertType)) {
          // MONITOR or SKIP — only send if recommendation changed
          if (alertType === "MONITOR" || alertType === "SKIP") {
            if (result.recommendation === user.last_recommendation) {
              await supabase.from("sms_logs").insert({
                user_id: user.id,
                message_body: "",
                alert_type: alertType,
                status: "skipped",
                error_message: "no status change",
              });
              results.push({ userId: user.id, status: "skipped", reason: "no status change" });
              continue;
            }
          } else if (!alertType) {
            // No alert type at all → skip
            await supabase.from("sms_logs").insert({
              user_id: user.id,
              message_body: "",
              alert_type: result.recommendation || "NONE",
              status: "skipped",
              error_message: "no alert type",
            });
            results.push({ userId: user.id, status: "skipped", reason: "no alert type" });
            continue;
          }
        }

        // Step 3 — Generate short link
        const shortlink = await createShortLink();

        // Step 4 — Build message
        const template = SMS_TEMPLATES[alertType];
        if (!template) {
          console.error(`No SMS template for alertType: ${alertType}`);
          results.push({ userId: user.id, status: "error", reason: `no template for ${alertType}` });
          continue;
        }
        const messageBody = template.replace("{shortlink}", shortlink);

        // Step 5 — Send via send-sms
        const smsResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/send-sms`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId: user.id,
              message: messageBody,
              alertType,
            }),
          }
        );

        const smsResult = await smsResponse.json();

        if (smsResult.status === "sent") {
          // Update last_recommendation on success
          await supabase
            .from("profiles")
            .update({ last_recommendation: result.recommendation } as any)
            .eq("id", user.id);

          results.push({ userId: user.id, status: "sent" });
        } else {
          results.push({ userId: user.id, status: smsResult.status, reason: smsResult.reason || smsResult.error });
        }
      } catch (userErr) {
        console.error(`dispatch-sms error for user ${user.id}:`, userErr);
        results.push({ userId: user.id, status: "error", reason: (userErr as Error).message });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    console.log(`dispatch-sms [${timezone_group}] complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({ status: "ok", timezone_group, total: users.length, sent, skipped, errors, details: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dispatch-sms error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
