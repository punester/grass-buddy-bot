/**
 * daily-weather-job — Daily ZIP cache refresh + Monday email digest + seasonal alerts
 *
 * Runs daily at 11:00 UTC (7am ET). Refreshes weather data for all ZIP codes
 * in the profiles table. On Mondays, sends weekly digest emails via the email
 * queue. Every day, checks for seasonal alert triggers and enqueues one-time
 * milestone emails.
 *
 * Manual trigger: POST with optional JSON body:
 *   { "forceEmail": true, "testZip": "01545" }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type TuningParams,
  type ZipWeatherResult,
  type SeasonalAlert,
  getTuningParams,
  fetchWeatherForZip,
  personalizeForUser,
  evaluateSeasonalState,
  determineSeasonalAlert,
} from "../_shared/recommendation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Email queue constants
const SITE_NAME = "ThirstyGrass";
const SENDER_DOMAIN = "notify.thirstygrass.com";
const FROM_EMAIL = `${SITE_NAME} <hello@thirstygrass.com>`;
const REPLY_TO = "hello@thirstygrass.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ──────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  zip_code: string;
  grass_type: string | null;
  lawn_size_acres: number | null;
  email_unsubscribed: boolean | null;
  last_seasonal_alert_sent: string | null;
  last_seasonal_alert_date: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

// ── Email queue helper ────────────────────────────────

async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  label: string;
  userId: string;
  date: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; messageId: string }> {
  const messageId = crypto.randomUUID();
  const idempotencyKey = `${params.label}-${params.userId}-${params.date}`;

  // Log pending BEFORE enqueue
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: params.label,
    recipient_email: params.to,
    status: "pending",
    metadata: params.metadata || null,
  });

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: params.to,
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      sender_domain: SENDER_DOMAIN,
      subject: params.subject,
      html: params.html,
      purpose: "transactional",
      label: params.label,
      idempotency_key: idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error(`Failed to enqueue ${params.label} email`, { to: params.to, error });
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: params.label,
      recipient_email: params.to,
      status: "failed",
      error_message: `Enqueue failed: ${error.message}`,
    });
    return { success: false, messageId };
  }

  return { success: true, messageId };
}

// ── Lawn care tips ─────────────────────────────────────

const TIPS = [
  "Water deeply and infrequently — 1\" at a time trains roots to go deeper.",
  "Early morning watering (5–9am) reduces evaporation and fungal risk.",
  "Mow at the highest setting for your grass type to retain soil moisture.",
  "A light layer of compost in fall reduces how much water your lawn needs next summer.",
  "Brown isn't always dead — cool-season grasses go dormant in heat and bounce back.",
  "Check your sprinkler heads seasonally — one clogged head wastes hundreds of gallons.",
  "Grass clippings left on the lawn return moisture and nitrogen to the soil.",
  "Aerate in fall or spring to help water reach roots instead of running off.",
];

function getTipOfTheWeek(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return TIPS[week % TIPS.length];
}

// ── Weather narrative ──────────────────────────────────

function generateNarrative(data: ZipWeatherResult): string {
  let narrative = "";
  if (data.forecast_5d > 0.75) {
    narrative = `Expect ${data.forecast_5d.toFixed(1)}" of rain in the coming days — your lawn should be in good shape.`;
  } else if (data.forecast_3d > 0.3) {
    narrative = `Some rain is on the way (${data.forecast_3d.toFixed(1)}" expected in the next 3 days), but it may not be enough.`;
  } else if (data.rain_5d > 0.75) {
    narrative = `You got good rainfall this past week (${data.rain_5d.toFixed(1)}" received). The forecast ahead looks drier.`;
  } else {
    narrative = `It's been dry and the forecast isn't offering much relief — ${data.forecast_5d.toFixed(1)}" expected over the next 5 days.`;
  }
  if (data.et_loss_7d > 1.0) {
    narrative += ` Heat and sun have been pulling moisture out of the soil (${data.et_loss_7d.toFixed(1)}" evaporated this week).`;
  }
  return narrative;
}

// ── Email HTML builder (weekly digest) ─────────────────

function buildEmailHtml(
  data: ZipWeatherResult,
  personal: { recommendation: string; recommendation_reason: string; deficit: number },
  narrative: string,
  tip: string,
  lawnSizeAcres: number | null,
  dashboardUrl: string,
  unsubscribeUrl: string
): string {
  const statusColors: Record<string, string> = { WATER: "#dc2626", MONITOR: "#d97706", SKIP: "#16a34a" };
  const statusLabels: Record<string, string> = { WATER: "💧 WATER", MONITOR: "⚠️ MONITOR", SKIP: "✅ SKIP" };
  const color = statusColors[personal.recommendation];
  const label = statusLabels[personal.recommendation];

  let wateringBlock = "";
  if (personal.recommendation === "WATER" && lawnSizeAcres && lawnSizeAcres > 0) {
    const lawnSqFt = lawnSizeAcres * 43560;
    const gallonsNeeded = personal.deficit * lawnSqFt * 0.623;
    const minutes = Math.ceil(gallonsNeeded / 2);
    wateringBlock = `
        <tr><td style="padding:16px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;">
            <tr><td style="padding:16px 20px;text-align:center;">
              <span style="font-size:24px;font-weight:bold;color:#16a34a;">⏱ ${minutes} minutes</span><br>
              <span style="font-size:13px;color:#374151;">Run your sprinklers for ${minutes} minutes</span><br>
              <span style="font-size:11px;color:#9ca3af;">Based on your ${lawnSizeAcres} acre lawn at 2 GPM flow rate</span>
            </td></tr>
          </table>
        </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:30px 15px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 30px;text-align:center;">
          <span style="font-size:22px;font-weight:bold;color:#16a34a;">ThirstyGrass</span>
          <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Your weekly lawn watering report</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:${color};border-radius:10px;padding:22px 20px;text-align:center;">
              <span style="font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${label}</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 30px 4px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">${personal.recommendation_reason}</p>
        </td></tr>
        <tr><td style="padding:8px 30px 20px;">
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${narrative}</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
            <tr>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;">
                <span style="font-size:20px;">🌧</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.rain_5d.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Rain this week</span>
              </td>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                <span style="font-size:20px;">☀️</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.et_loss_7d.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Evaporated</span>
              </td>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;">
                <span style="font-size:20px;">⛅</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.forecast_5d.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Forecast</span>
              </td>
            </tr>
          </table>
        </td></tr>
        ${wateringBlock}
        <tr><td style="padding:20px 30px;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;">Tip of the Week</p>
          <p style="margin:0;font-size:13px;color:#374151;font-style:italic;line-height:1.5;">${tip}</p>
        </td></tr>
        <tr><td style="padding:20px 30px;text-align:center;">
          <a href="${dashboardUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;">View My Dashboard</a>
        </td></tr>
        <tr><td style="padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you have a ThirstyGrass account. We send watering updates every Monday.</p>
          <a href="${unsubscribeUrl}" style="font-size:12px;color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          <p style="margin:10px 0 0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ThirstyGrass by 110 Labs</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Seasonal alert email HTML builders ────────────────

function buildSeasonalEmailHtml(
  alertType: SeasonalAlert,
  grassType: string,
  avgHigh7d: number,
  forecastLow5d: number,
  dashboardUrl: string,
  unsubscribeUrl: string,
): string {
  const dormancyThreshold =
    grassType === "Cool-Season" ? 45 :
    grassType === "Warm-Season" ? 55 : 50;

  let emoji = "";
  let heading = "";
  let bodyContent = "";

  if (alertType === "DORMANCY_START") {
    emoji = "🌾";
    heading = "Your lawn is going dormant";
    bodyContent = `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Based on temperature data for your ZIP code, your lawn has entered dormancy — the 7-day average high has dropped below ${dormancyThreshold}°F for ${grassType} grass.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:bold;">What this means:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
        <li>No watering needed until spring</li>
        <li>We'll keep watching your forecast</li>
        <li>You'll get an alert the moment it's time to start again</li>
      </ul>
      <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">
        ThirstyGrass is still on watch. Enjoy the off-season.
      </p>`;
  } else if (alertType === "DORMANCY_END") {
    emoji = "🌱";
    heading = "Time to start watering again";
    bodyContent = `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Spring is here for your lawn. The 7-day average high for your ZIP code has climbed back above ${dormancyThreshold}°F — your ${grassType} grass is waking up.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">
        Log in to see your first watering recommendation of the season.
      </p>`;
  } else if (alertType === "FROST_INCOMING") {
    emoji = "❄️";
    heading = "Frost alert for your lawn";
    bodyContent = `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Freezing temperatures are forecast in your area in the next 5 days (low of ${Math.round(forecastLow5d)}°F).
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">
        Skip watering until the frost window passes — water in the soil can freeze and damage grass roots. We'll update your recommendation daily.
      </p>`;
  }

  const bannerColor = alertType === "FROST_INCOMING" ? "#93c5fd" : "#9ca3af";
  const textColor = "#374151";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:30px 15px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 30px;text-align:center;">
          <span style="font-size:22px;font-weight:bold;color:#16a34a;">ThirstyGrass</span>
          <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Seasonal alert</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:${bannerColor};border-radius:10px;padding:22px 20px;text-align:center;">
              <span style="font-size:32px;">${emoji}</span><br>
              <span style="font-size:24px;font-weight:bold;color:${textColor};letter-spacing:1px;">${heading}</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 30px;">
          ${bodyContent}
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;">
            <tr><td style="padding:12px 16px;">
              <span style="font-size:12px;color:#6b7280;">7-day avg high: <strong>${Math.round(avgHigh7d)}°F</strong></span><br>
              <span style="font-size:12px;color:#6b7280;">Forecast low: <strong>${Math.round(forecastLow5d)}°F</strong></span><br>
              <span style="font-size:12px;color:#6b7280;">Grass type: <strong>${grassType}</strong> (threshold: ${dormancyThreshold}°F)</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 30px;text-align:center;">
          <a href="${dashboardUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;">View My Dashboard</a>
        </td></tr>
        <tr><td style="padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you have a ThirstyGrass account.</p>
          <a href="${unsubscribeUrl}" style="font-size:12px;color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          <p style="margin:10px 0 0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ThirstyGrass by 110 Labs</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getSeasonalSubject(alertType: SeasonalAlert): string {
  switch (alertType) {
    case "DORMANCY_START": return "Your lawn is going dormant 🌾";
    case "DORMANCY_END": return "Time to start watering again 🌱";
    case "FROST_INCOMING": return "Frost alert for your lawn ❄️";
    default: return "Seasonal update from ThirstyGrass";
  }
}

// ── Send seasonal alert email ─────────────────────────

async function sendSeasonalAlert(
  profile: Profile,
  alertType: SeasonalAlert,
  cached: ZipWeatherResult,
): Promise<boolean> {
  if (!alertType) return false;

  const grassType = profile.grass_type || "Mixed";
  const unsubscribeUrl = `https://thirstygrass.com/email-unsubscribe?user_id=${profile.id}`;
  const today = new Date().toISOString().slice(0, 10);

  // Generate magic link
  let dashboardUrl = "https://thirstygrass.com/dashboard";
  try {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: { redirectTo: "https://thirstygrass.com/dashboard" },
    });
    if (!linkError && linkData?.properties?.action_link) {
      dashboardUrl = linkData.properties.action_link;
    }
  } catch { /* fallback URL */ }

  const emailHtml = buildSeasonalEmailHtml(
    alertType, grassType, cached.avgHigh7d, cached.forecastLow5d,
    dashboardUrl, unsubscribeUrl
  );
  const subject = getSeasonalSubject(alertType);
  const templateName = `seasonal-${alertType.toLowerCase().replace(/_/g, "-")}`;

  const { success } = await enqueueEmail({
    to: profile.email,
    subject,
    html: emailHtml,
    label: templateName,
    userId: profile.id,
    date: today,
    metadata: {
      alert_type: alertType,
      zip_code: profile.zip_code,
      grass_type: grassType,
      avg_high_7d: cached.avgHigh7d,
      forecast_low_5d: cached.forecastLow5d,
    },
  });

  if (success) {
    // Update profile tracking
    await supabase
      .from("profiles")
      .update({
        last_seasonal_alert_sent: alertType,
        last_seasonal_alert_date: today,
      })
      .eq("id", profile.id);
  }

  return success;
}

// ── Main Handler ───────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse optional body for manual triggers
    let forceEmail = false;
    let testZip: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        forceEmail = body.forceEmail === true;
        testZip = body.testZip || null;
      } catch { /* empty body = normal cron run */ }
    }

    const tuning = await getTuningParams(supabase);

    // ── STEP 1: Get unique ZIP codes with stored coords ─
    let zipCodes: { zip: string; lat: number | null; lng: number | null }[] = [];
    if (testZip) {
      zipCodes = [{ zip: testZip, lat: null, lng: null }];
    } else {
      let offset = 0;
      const pageSize = 500;
      const zipMap = new Map<string, { lat: number | null; lng: number | null }>();
      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("zip_code, latitude, longitude")
          .not("zip_code", "is", null)
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`DB query failed: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (row.zip_code && !zipMap.has(row.zip_code)) {
            zipMap.set(row.zip_code, { lat: row.latitude, lng: row.longitude });
          }
        }
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      zipCodes = Array.from(zipMap.entries()).map(([zip, coords]) => ({
        zip,
        lat: coords.lat,
        lng: coords.lng,
      }));
    }

    console.log(`Processing ${zipCodes.length} unique ZIP codes`);

    // ── STEP 2-4: Fetch weather + upsert cache ──────
    let zipsProcessed = 0;
    let zipErrors = 0;
    const zipCache = new Map<string, ZipWeatherResult>();

    for (const zipEntry of zipCodes) {
      try {
        const result = await fetchWeatherForZip(zipEntry.zip, tuning, zipEntry.lat, zipEntry.lng);
        zipCache.set(zipEntry.zip, result);

        // Upsert into zip_cache
        const { error: upsertError } = await supabase
          .from("zip_cache")
          .upsert({
            zip_code: zipEntry.zip,
            recommendation: result.recommendation,
            recommendation_reason: result.recommendation_reason,
            rain_5d: result.rain_5d,
            forecast_5d: result.forecast_5d,
            et_loss_7d: result.et_loss_7d,
            deficit: result.deficit,
            last_updated: new Date().toISOString(),
            cached_at: new Date().toISOString(),
            weather_data: {
              precipitation: { day1: 0, day3: result.rain_3d, day5: result.rain_5d },
              forecast: { day1: 0, day3: result.forecast_3d, day5: result.forecast_5d, recommendedWateringDay: -1 },
              recommendation: result.recommendation,
              recommendationReason: result.recommendation_reason,
              etLoss7d: result.et_loss_7d,
              deficit: result.deficit,
              weeklyNeed: result.et_loss_7d * tuning.mixed_multiplier,
              lastUpdated: new Date().toLocaleString(),
              address: zipEntry.zip,
              grassType: "Mixed",
              avgHigh7d: result.avgHigh7d,
              forecastLow5d: result.forecastLow5d,
            },
          }, { onConflict: "zip_code" });

        if (upsertError) {
          console.error(`Upsert error for ${zipEntry.zip}: ${upsertError.message}`);
          zipErrors++;
        } else {
          zipsProcessed++;
        }

        // Small delay to avoid rate-limiting Open-Meteo
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error(`Error fetching weather for ZIP ${zipEntry.zip}:`, err);
        zipErrors++;
      }
    }

    console.log(`Cache refresh done. Processed: ${zipsProcessed}, Errors: ${zipErrors}`);

    // ── STEP 5: Fetch ALL profiles for seasonal alerts ──
    // Seasonal alerts run every day, not just Mondays
    let allProfilesFull: Profile[] = [];
    {
      let offset = 0;
      const pageSize = 500;
      while (true) {
        let query = supabase
          .from("profiles")
          .select("id, email, zip_code, grass_type, lawn_size_acres, email_unsubscribed, last_seasonal_alert_sent, last_seasonal_alert_date, latitude, longitude, timezone")
          .not("zip_code", "is", null)
          .not("email", "is", null);

        if (testZip) {
          query = query.eq("zip_code", testZip);
        }

        const { data: profiles, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw new Error(`DB query failed: ${error.message}`);
        if (!profiles || profiles.length === 0) break;

        const eligible = profiles.filter(
          (p: Profile) => !p.email_unsubscribed && p.zip_code && p.email
        );
        allProfilesFull = allProfilesFull.concat(eligible);
        if (profiles.length < pageSize) break;
        offset += pageSize;
      }
    }

    // ── STEP 5b: Send seasonal alert emails ─────────
    let seasonalSent = 0;
    let seasonalErrors = 0;
    const seasonalAlertedUserIds = new Set<string>();

    for (const profile of allProfilesFull) {
      try {
        const cached = zipCache.get(profile.zip_code);
        if (!cached) continue;

        const grassType = profile.grass_type || "Mixed";
        const { seasonalState } = evaluateSeasonalState(cached.avgHigh7d, cached.forecastLow5d, grassType);

        const alertType = determineSeasonalAlert(
          seasonalState,
          profile.last_seasonal_alert_sent,
          profile.last_seasonal_alert_date,
        );

        if (alertType) {
          console.log(`Enqueuing ${alertType} alert to ${profile.email}`);
          const success = await sendSeasonalAlert(profile, alertType, cached);
          if (success) {
            seasonalSent++;
            seasonalAlertedUserIds.add(profile.id);
          } else {
            seasonalErrors++;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err) {
        console.error(`Seasonal alert error for ${profile.email}:`, err);
        seasonalErrors++;
      }
    }

    console.log(`Seasonal alerts: enqueued=${seasonalSent}, errors=${seasonalErrors}`);

    // ── STEP 6: Check if Monday (ET timezone) ────────
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
    });
    const dayOfWeek = etFormatter.format(now);
    const isMonday = dayOfWeek === "Monday";

    if (!isMonday && !forceEmail) {
      console.log(`Today is ${dayOfWeek} — skipping weekly digest. Cache refresh + seasonal alerts complete.`);
      return new Response(
        JSON.stringify({
          success: true,
          mode: "cache_and_seasonal",
          zipsProcessed,
          zipErrors,
          seasonalSent,
          seasonalErrors,
          day: dayOfWeek,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── STEP 7: Send weekly digest emails ────────────
    console.log(forceEmail ? "Force email mode — sending regardless of day" : "It's Monday — sending weekly digest");

    const tip = getTipOfTheWeek();
    const fallbackDashboardUrl = "https://thirstygrass.com/dashboard";
    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let emailErrors = 0;
    const subjectMap: Record<string, string> = {
      WATER: "Your lawn needs water this week 💧",
      MONITOR: "Keep an eye on your lawn this week 👀",
      SKIP: "No watering needed this week ✅",
    };

    for (const profile of allProfilesFull) {
      try {
        // Skip weekly digest if user already received a seasonal alert today
        if (seasonalAlertedUserIds.has(profile.id)) {
          console.log(`Skipping weekly digest for ${profile.email} — seasonal alert already sent`);
          continue;
        }
        // Get cached ZIP data
        let cached = zipCache.get(profile.zip_code);
        if (!cached) {
          // Also try to get real temperatures from weather_data JSON
          const { data: fullRow } = await supabase
            .from("zip_cache")
            .select("rain_5d, forecast_5d, et_loss_7d, deficit, recommendation, recommendation_reason, weather_data")
            .eq("zip_code", profile.zip_code)
            .single();
          if (!fullRow) {
            console.warn(`No cache for ZIP ${profile.zip_code}, skipping ${profile.email}`);
            continue;
          }
          const wd = fullRow.weather_data as Record<string, any> | null;
          cached = {
            rain_5d: Number(fullRow.rain_5d),
            rain_3d: 0,
            forecast_5d: Number(fullRow.forecast_5d),
            forecast_3d: 0,
            et_loss_7d: Number(fullRow.et_loss_7d),
            deficit: Number(fullRow.deficit),
            recommendation: fullRow.recommendation as "WATER" | "MONITOR" | "SKIP",
            recommendation_reason: fullRow.recommendation_reason || "",
            avgHigh7d: wd?.avgHigh7d ?? 80,
            forecastLow5d: wd?.forecastLow5d ?? 50,
          };
        }

        // Personalize for user's grass type
        const personal = personalizeForUser(cached, profile.grass_type, tuning);
        const narrative = generateNarrative(cached);
        const unsubscribeUrl = `https://thirstygrass.com/email-unsubscribe?user_id=${profile.id}`;

        // Upsert recommendation_history
        try {
          await supabase.from("recommendation_history").upsert({
            user_id: profile.id,
            date: today,
            recommendation: personal.recommendation,
            alert_type: null,
            deficit: personal.deficit,
            et_loss_7d: cached.et_loss_7d,
            rain_5d: cached.rain_5d,
            forecast_5d: cached.forecast_5d,
            avg_high_7d: cached.avgHigh7d,
            forecast_low_5d: cached.forecastLow5d,
            source: "cron",
          }, { onConflict: "user_id,date" });
        } catch { /* non-critical */ }

        // Generate magic link
        let dashboardUrl = fallbackDashboardUrl;
        try {
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: profile.email,
            options: {
              redirectTo: "https://thirstygrass.com/dashboard",
            },
          });
          if (linkError) {
            console.warn(`Magic link failed for ${profile.email}: ${linkError.message}`);
          } else if (linkData?.properties?.action_link) {
            dashboardUrl = linkData.properties.action_link;
          }
        } catch (linkErr) {
          console.warn(`Magic link error for ${profile.email}:`, linkErr);
        }

        const emailHtml = buildEmailHtml(
          cached, personal, narrative, tip,
          profile.lawn_size_acres, dashboardUrl, unsubscribeUrl
        );
        const subject = subjectMap[personal.recommendation] || "Your weekly lawn report";

        const { success } = await enqueueEmail({
          to: profile.email,
          subject,
          html: emailHtml,
          label: "weekly-digest",
          userId: profile.id,
          date: today,
          metadata: {
            recommendation: personal.recommendation,
            zip_code: profile.zip_code,
            subject,
            rain_5d: cached.rain_5d,
            forecast_5d: cached.forecast_5d,
            et_loss_7d: cached.et_loss_7d,
            deficit: personal.deficit,
            lawn_size_acres: profile.lawn_size_acres,
          },
        });

        if (success) {
          sent++;
        } else {
          emailErrors++;
        }

        // Rate limit protection
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error processing ${profile.email}:`, err);
        emailErrors++;
      }
    }

    // ── STEP 8: Summary ──────────────────────────────
    const summary = {
      success: true,
      mode: testZip ? "test" : "full",
      zipsProcessed,
      zipErrors,
      emailsEnqueued: sent,
      emailErrors,
      seasonalSent,
      seasonalErrors,
      totalEligible: allProfilesFull.length,
    };
    console.log("Job complete.", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-weather-job error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
