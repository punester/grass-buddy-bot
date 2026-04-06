/**
 * daily-weather-job — Daily ZIP cache refresh + Monday email digest + seasonal alerts
 *
 * Runs daily at 11:00 UTC (7am ET). Refreshes weather data for all ZIP codes
 * in the profiles table. On Mondays, sends weekly digest emails via Resend.
 * Every day, checks for seasonal alert triggers and sends one-time milestone emails.
 *
 * Manual trigger: POST with optional JSON body:
 *   { "forceEmail": true, "testZip": "01545" }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

interface ZipWeatherResult {
  rain_5d: number;
  rain_3d: number;
  forecast_5d: number;
  forecast_3d: number;
  et_loss_7d: number;
  deficit: number;
  recommendation: "WATER" | "MONITOR" | "SKIP";
  recommendation_reason: string;
  avgHigh7d: number;
  forecastLow5d: number;
}

interface TuningParams {
  saturation_guard_inches: number;
  saturation_guard_days: number;
  water_threshold: number;
  monitor_threshold: number;
  cool_season_multiplier: number;
  warm_season_multiplier: number;
  mixed_multiplier: number;
}

const DEFAULTS: TuningParams = {
  saturation_guard_inches: 0.5,
  saturation_guard_days: 3,
  water_threshold: 0.25,
  monitor_threshold: 0.05,
  cool_season_multiplier: 1.25,
  warm_season_multiplier: 0.75,
  mixed_multiplier: 1.0,
};

// ── Tuning params ──────────────────────────────────────

async function getTuningParams(): Promise<TuningParams> {
  try {
    const { data } = await supabase.from("admin_settings").select("key, value");
    if (data && data.length > 0) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.key] = row.value;
      return {
        saturation_guard_inches: parseFloat(map.saturation_guard_inches) || DEFAULTS.saturation_guard_inches,
        saturation_guard_days: parseInt(map.saturation_guard_days) || DEFAULTS.saturation_guard_days,
        water_threshold: parseFloat(map.water_threshold) || DEFAULTS.water_threshold,
        monitor_threshold: parseFloat(map.monitor_threshold) || DEFAULTS.monitor_threshold,
        cool_season_multiplier: parseFloat(map.cool_season_multiplier) || DEFAULTS.cool_season_multiplier,
        warm_season_multiplier: parseFloat(map.warm_season_multiplier) || DEFAULTS.warm_season_multiplier,
        mixed_multiplier: parseFloat(map.mixed_multiplier) || DEFAULTS.mixed_multiplier,
      };
    }
  } catch { /* fall through */ }
  return { ...DEFAULTS };
}

// ── Helpers ────────────────────────────────────────────

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

// ── Fetch with retry ──────────────────────────────────

async function fetchWithRetry(url: string, retries = 2, backoffMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (attempt < retries && (res.status >= 500 || res.status === 429)) {
      console.warn(`Fetch ${url} failed (${res.status}), retry ${attempt + 1}/${retries} in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      continue;
    }
    throw new Error(`Fetch failed (${res.status}) after ${attempt + 1} attempts`);
  }
  throw new Error("Unreachable");
}

// ── Weather fetch ──────────────────────────────────────

async function fetchWeatherForZip(
  zipCode: string,
  tuning: TuningParams,
  storedLat?: number | null,
  storedLng?: number | null,
): Promise<ZipWeatherResult> {
  let latitude: number;
  let longitude: number;

  if (storedLat != null && storedLng != null) {
    latitude = storedLat;
    longitude = storedLng;
  } else {
    const geoRes = await fetchWithRetry(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zipCode)}&count=1&country=US&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) throw new Error(`No location for ZIP ${zipCode}`);
    latitude = geoData.results[0].latitude;
    longitude = geoData.results[0].longitude;
  }

  const weatherRes = await fetchWithRetry(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min&past_days=7&forecast_days=7&timezone=auto&precipitation_unit=inch`
  );
  const weatherData = await weatherRes.json();
  const daily = weatherData.daily;

  if (!daily?.time || !daily?.precipitation_sum) {
    throw new Error("Bad weather response");
  }

  const todayIndex = 7;
  const sumSlice = (arr: number[], start: number, end: number): number => {
    let sum = 0;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      sum += arr[i] ?? 0;
    }
    return sum;
  };

  const avgSlice = (arr: number[], start: number, end: number): number => {
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      if (arr[i] != null) { sum += arr[i]; count++; }
    }
    return count > 0 ? sum / count : 0;
  };

  const minSlice = (arr: number[], start: number, end: number): number => {
    let min = Infinity;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      if (arr[i] != null && arr[i] < min) min = arr[i];
    }
    return min === Infinity ? 0 : min;
  };

  const precip = daily.precipitation_sum;
  const et = daily.et0_fao_evapotranspiration;
  const tempMax = daily.temperature_2m_max;
  const tempMin = daily.temperature_2m_min;

  const rain_3d = sumSlice(precip, todayIndex - 3, todayIndex);
  const rain_5d = sumSlice(precip, todayIndex - 5, todayIndex);
  const forecast_3d = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecast_5d = sumSlice(precip, todayIndex, todayIndex + 5);
  const et_loss_7d = sumSlice(et, todayIndex - 7, todayIndex) / 25.4;

  // Temperature
  const avgHigh7d = cToF(avgSlice(tempMax, todayIndex - 7, todayIndex));
  const forecastLow5d = cToF(minSlice(tempMin, todayIndex, todayIndex + 5));

  // Default Mixed multiplier for ZIP-level cache
  const deficit = et_loss_7d * tuning.mixed_multiplier - rain_5d - forecast_5d;

  const { recommendation, recommendation_reason } = computeRecommendation(
    rain_3d, deficit, tuning
  );

  return { rain_5d, rain_3d, forecast_5d, forecast_3d, et_loss_7d, deficit, recommendation, recommendation_reason, avgHigh7d, forecastLow5d };
}

function computeRecommendation(
  rain_3d: number,
  deficit: number,
  tuning: TuningParams
): { recommendation: "WATER" | "MONITOR" | "SKIP"; recommendation_reason: string } {
  if (rain_3d > tuning.saturation_guard_inches) {
    return {
      recommendation: "SKIP",
      recommendation_reason: "Soil is likely saturated from recent rainfall. No watering needed right now.",
    };
  }
  if (deficit > tuning.water_threshold) {
    return {
      recommendation: "WATER",
      recommendation_reason: "Your lawn needs water — recent rainfall and forecast aren't enough to offset evaporation losses.",
    };
  }
  if (deficit > tuning.monitor_threshold) {
    return {
      recommendation: "MONITOR",
      recommendation_reason: "You're borderline. Skip today and check again tomorrow — conditions may resolve on their own.",
    };
  }
  return {
    recommendation: "SKIP",
    recommendation_reason: "Rain and forecast precipitation have your lawn covered. No watering needed this week.",
  };
}

// ── Personalize recommendation for a user's grass type ─

function personalizeForUser(
  cached: ZipWeatherResult,
  grassType: string | null,
  tuning: TuningParams
): { recommendation: "WATER" | "MONITOR" | "SKIP"; recommendation_reason: string; deficit: number } {
  const gt = grassType || "Mixed";

  // Check seasonal state FIRST — override deficit logic if dormant/frost
  const { seasonalState, seasonalMessage } = evaluateSeasonalState(
    cached.avgHigh7d, cached.forecastLow5d, gt
  );

  if (seasonalState !== "ACTIVE") {
    return {
      recommendation: "SKIP",
      recommendation_reason: seasonalMessage,
      deficit: 0,
    };
  }

  const multiplier =
    gt === "Cool-Season" ? tuning.cool_season_multiplier :
    gt === "Warm-Season" ? tuning.warm_season_multiplier :
    tuning.mixed_multiplier;

  const personalDeficit = cached.et_loss_7d * multiplier - cached.rain_5d - cached.forecast_5d;
  const { recommendation, recommendation_reason } = computeRecommendation(
    cached.rain_3d, personalDeficit, tuning
  );
  return { recommendation, recommendation_reason, deficit: personalDeficit };
}

// ── Seasonal state evaluation ─────────────────────────

type SeasonalAlert = "DORMANCY_START" | "DORMANCY_END" | "FROST_INCOMING" | null;

function evaluateSeasonalState(
  avgHigh7d: number,
  forecastLow5d: number,
  grassType: string,
): { seasonalState: "ACTIVE" | "DORMANT" | "FROST_RISK"; seasonalMessage: string } {
  const dormancyThreshold =
    grassType === "Cool-Season" ? 45 :
    grassType === "Warm-Season" ? 55 : 50;

  if (forecastLow5d <= 34) {
    return {
      seasonalState: "FROST_RISK",
      seasonalMessage: `Frost expected in the next 5 days. Avoid watering — frozen water in soil can damage roots.`,
    };
  }
  if (avgHigh7d < dormancyThreshold) {
    return {
      seasonalState: "DORMANT",
      seasonalMessage: `Your lawn is dormant — 7-day average high is ${Math.round(avgHigh7d)}°F, below the ${dormancyThreshold}°F threshold for your grass type.`,
    };
  }
  return { seasonalState: "ACTIVE", seasonalMessage: "" };
}

function determineSeasonalAlert(
  currentState: "ACTIVE" | "DORMANT" | "FROST_RISK",
  lastAlertSent: string | null,
  lastAlertDate: string | null,
): SeasonalAlert {
  const today = new Date().toISOString().slice(0, 10);

  // How many days since last alert
  let daysSinceLastAlert = 999;
  if (lastAlertDate) {
    const last = new Date(lastAlertDate);
    const now = new Date(today);
    daysSinceLastAlert = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (currentState === "FROST_RISK") {
    // Re-alert if last alert wasn't FROST_INCOMING or was >7 days ago
    if (lastAlertSent !== "FROST_INCOMING" || daysSinceLastAlert > 7) {
      return "FROST_INCOMING";
    }
    return null;
  }

  if (currentState === "DORMANT") {
    if (lastAlertSent !== "DORMANCY_START" || daysSinceLastAlert > 7) {
      return "DORMANCY_START";
    }
    return null;
  }

  // ACTIVE
  if (currentState === "ACTIVE" && (lastAlertSent === "DORMANCY_START" || lastAlertSent === "FROST_INCOMING")) {
    return "DORMANCY_END";
  }

  return null;
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

// ── Email HTML builder ─────────────────────────────────

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

// ── Send seasonal alert email ─────────────────────────

async function sendSeasonalAlert(
  profile: Profile,
  alertType: SeasonalAlert,
  cached: ZipWeatherResult,
): Promise<boolean> {
  if (!alertType) return false;

  const grassType = profile.grass_type || "Mixed";
  const unsubscribeUrl = `https://thirstygrass.com/email-unsubscribe?user_id=${profile.id}`;

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

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "ThirstyGrass <hello@thirstygrass.com>",
      reply_to: "hello@thirstygrass.com",
      to: [profile.email],
      subject,
      html: emailHtml,
    }),
  });

  const resendBody = await resendRes.json().catch(() => ({}));
  const templateName = `seasonal-${alertType.toLowerCase().replace(/_/g, "-")}`;

  if (resendRes.ok) {
    await supabase.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: profile.email,
      status: "sent",
      message_id: resendBody?.id || null,
      metadata: {
        alert_type: alertType,
        zip_code: profile.zip_code,
        grass_type: grassType,
        avg_high_7d: cached.avgHigh7d,
        forecast_low_5d: cached.forecastLow5d,
      },
    });

    // Update profile tracking
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("profiles")
      .update({
        last_seasonal_alert_sent: alertType,
        last_seasonal_alert_date: today,
      })
      .eq("id", profile.id);

    return true;
  } else {
    const errText = JSON.stringify(resendBody);
    console.error(`Seasonal alert email error for ${profile.email}: ${errText}`);
    await supabase.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: profile.email,
      status: "failed",
      error_message: errText,
      metadata: { alert_type: alertType, zip_code: profile.zip_code },
    });
    return false;
  }
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

    const tuning = await getTuningParams();

    // ── STEP 1: Get unique ZIP codes ─────────────────
    let zipCodes: string[] = [];
    if (testZip) {
      zipCodes = [testZip];
    } else {
      let offset = 0;
      const pageSize = 500;
      const zipSet = new Set<string>();
      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("zip_code")
          .not("zip_code", "is", null)
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`DB query failed: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (row.zip_code) zipSet.add(row.zip_code);
        }
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      zipCodes = Array.from(zipSet);
    }

    console.log(`Processing ${zipCodes.length} unique ZIP codes`);

    // ── STEP 2-4: Fetch weather + upsert cache ──────
    let zipsProcessed = 0;
    let zipErrors = 0;
    const zipCache = new Map<string, ZipWeatherResult>();

    for (const zip of zipCodes) {
      try {
        const result = await fetchWeatherForZip(zip, tuning);
        zipCache.set(zip, result);

        // Upsert into zip_cache
        const { error: upsertError } = await supabase
          .from("zip_cache")
          .upsert({
            zip_code: zip,
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
              address: zip,
              grassType: "Mixed",
              avgHigh7d: result.avgHigh7d,
              forecastLow5d: result.forecastLow5d,
            },
          }, { onConflict: "zip_code" });

        if (upsertError) {
          console.error(`Upsert error for ${zip}: ${upsertError.message}`);
          zipErrors++;
        } else {
          zipsProcessed++;
        }

        // Small delay to avoid rate-limiting Open-Meteo
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error(`Error fetching weather for ZIP ${zip}:`, err);
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
          .select("id, email, zip_code, grass_type, lawn_size_acres, email_unsubscribed, last_seasonal_alert_sent, last_seasonal_alert_date")
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
          console.log(`Sending ${alertType} alert to ${profile.email}`);
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

    console.log(`Seasonal alerts: sent=${seasonalSent}, errors=${seasonalErrors}`);

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

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "ThirstyGrass <hello@thirstygrass.com>",
            reply_to: "hello@thirstygrass.com",
            to: [profile.email],
            subject,
            html: emailHtml,
          }),
        });

        const resendBody = await resendRes.json().catch(() => ({}));
        if (resendRes.ok) {
          sent++;
          await supabase.from("email_send_log").insert({
            template_name: "weekly-digest",
            recipient_email: profile.email,
            status: "sent",
            message_id: resendBody?.id || null,
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
        } else {
          const errText = JSON.stringify(resendBody);
          console.error(`Resend error for ${profile.email}: ${errText}`);
          emailErrors++;
          await supabase.from("email_send_log").insert({
            template_name: "weekly-digest",
            recipient_email: profile.email,
            status: "failed",
            error_message: errText,
            metadata: { recommendation: personal.recommendation, zip_code: profile.zip_code },
          });
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
      emailsSent: sent,
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
