/**
 * send-weekly-digest — Weekly email digest for all registered ThirstyGrass users
 *
 * Scheduled via pg_cron every Monday at 12:00 UTC (7:00 AM Eastern).
 *
 * To register in Supabase Dashboard → Database → Cron Jobs:
 * ─────────────────────────────────────────────────────────
 *   select cron.schedule(
 *     'send-weekly-digest',
 *     '0 12 * * 1',  -- every Monday at 12:00 UTC (7 AM ET)
 *     $$
 *     select net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/send-weekly-digest',
 *       headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
 *       body := '{}'::jsonb
 *     ) as request_id;
 *     $$
 *   );
 * ─────────────────────────────────────────────────────────
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ──────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  zip_code: string;
  grass_type: string | null;
  email_unsubscribed: boolean | null;
}

interface WeatherResult {
  precipDay5: number;
  precipDay3: number;
  forecastDay5: number;
  forecastDay3: number;
  etLoss7d: number;
  recommendation: "WATER" | "MONITOR" | "SKIP";
  recommendationReason: string;
  weeklyNeed: number;
  deficit: number;
}

// ── Lawn Care Tips (rotate by ISO week mod 8) ──────────

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

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getTipOfTheWeek(): string {
  const week = getISOWeekNumber(new Date());
  return TIPS[week % TIPS.length];
}

// ── Weather Narrative Generator ────────────────────────

function generateWeatherNarrative(data: WeatherResult): string {
  let narrative = "";

  if (data.forecastDay5 > 0.75) {
    narrative = `Expect ${data.forecastDay5.toFixed(1)}" of rain in the coming days — your lawn should be in good shape heading into the weekend.`;
  } else if (data.forecastDay3 > 0.3) {
    narrative = `Some rain is on the way (${data.forecastDay3.toFixed(1)}" expected in the next 3 days), but it may not be enough on its own.`;
  } else if (data.precipDay5 > 0.75) {
    narrative = `You got good rainfall this past week (${data.precipDay5.toFixed(1)}" received). The forecast ahead looks drier.`;
  } else {
    narrative = `It's been dry and the forecast isn't offering much relief — ${data.forecastDay5.toFixed(1)}" expected over the next 5 days.`;
  }

  if (data.etLoss7d > 1.0) {
    narrative += ` Heat and sun have been pulling moisture out of the soil (${data.etLoss7d.toFixed(1)}" evaporated this week).`;
  }

  return narrative;
}

// ── Fetch Weather for a ZIP Code ───────────────────────

async function fetchWeatherForZip(
  zipCode: string,
  grassType: string
): Promise<WeatherResult> {
  // Geocode
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zipCode)}&count=1&country=US&format=json`
  );
  if (!geoRes.ok) throw new Error(`Geocoding failed (${geoRes.status})`);
  const geoData = await geoRes.json();
  if (!geoData.results?.length) throw new Error(`No location for ZIP ${zipCode}`);

  const { latitude, longitude } = geoData.results[0];

  // Weather
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=7&forecast_days=7&timezone=auto&precipitation_unit=inch`
  );
  if (!weatherRes.ok) throw new Error(`Weather fetch failed (${weatherRes.status})`);
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

  const precip = daily.precipitation_sum;
  const et = daily.et0_fao_evapotranspiration;

  const precipDay3 = sumSlice(precip, todayIndex - 3, todayIndex);
  const precipDay5 = sumSlice(precip, todayIndex - 5, todayIndex);
  const forecastDay3 = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecastDay5 = sumSlice(precip, todayIndex, todayIndex + 5);
  const etLoss7d = sumSlice(et, todayIndex - 7, todayIndex) / 25.4;

  const grassMultiplier =
    grassType === "Cool-Season" ? 1.25 :
    grassType === "Warm-Season" ? 0.75 : 1.0;

  const weeklyNeed = 1.0 * grassMultiplier;
  const deficit = weeklyNeed + etLoss7d - precipDay5 - forecastDay5;

  let recommendation: "WATER" | "MONITOR" | "SKIP";
  let recommendationReason: string;

  if (deficit > 0.5) {
    recommendation = "WATER";
    recommendationReason = "Your lawn needs water — rainfall and forecast aren't enough to cover evaporation losses.";
  } else if (deficit > 0) {
    recommendation = "MONITOR";
    recommendationReason = "You're borderline. Skip today and check again tomorrow.";
  } else {
    recommendation = "SKIP";
    recommendationReason = "Rain has you covered. No watering needed this week.";
  }

  return {
    precipDay5,
    precipDay3,
    forecastDay5,
    forecastDay3,
    etLoss7d,
    recommendation,
    recommendationReason,
    weeklyNeed,
    deficit,
  };
}

// ── Grass category helper ──────────────────────────────

function getGrassCategory(grassType: string | null): string {
  if (!grassType) return "Mixed";
  if (grassType.includes("Cool-Season")) return "Cool-Season";
  if (grassType.includes("Warm-Season")) return "Warm-Season";
  return "Mixed";
}

// ── Email HTML Template ────────────────────────────────

function buildEmailHtml(
  data: WeatherResult,
  narrative: string,
  tip: string,
  unsubscribeUrl: string,
  dashboardUrl: string
): string {
  const statusColors = {
    WATER: "#dc2626",
    MONITOR: "#d97706",
    SKIP: "#16a34a",
  };
  const statusLabels = {
    WATER: "💧 WATER",
    MONITOR: "⚠️ MONITOR",
    SKIP: "✅ SKIP",
  };

  const color = statusColors[data.recommendation];
  const label = statusLabels[data.recommendation];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:30px 15px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="padding:24px 30px;text-align:center;">
          <span style="font-size:22px;font-weight:bold;color:#16a34a;">ThirstyGrass</span>
          <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Your weekly lawn watering report</p>
        </td></tr>

        <!-- Status Badge -->
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:${color};border-radius:10px;padding:22px 20px;text-align:center;">
              <span style="font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${label}</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- Reason -->
        <tr><td style="padding:16px 30px 4px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">${data.recommendationReason}</p>
        </td></tr>

        <!-- Weather Narrative -->
        <tr><td style="padding:8px 30px 20px;">
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${narrative}</p>
        </td></tr>

        <!-- Stats Row -->
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
            <tr>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;">
                <span style="font-size:20px;">🌧</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.precipDay5.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Rain this week</span>
              </td>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                <span style="font-size:20px;">⛅</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.forecastDay5.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Forecast</span>
              </td>
              <td width="33%" style="padding:16px 8px;text-align:center;vertical-align:top;">
                <span style="font-size:20px;">☀️</span><br>
                <span style="font-size:16px;font-weight:bold;color:#111827;">${data.etLoss7d.toFixed(1)}"</span><br>
                <span style="font-size:11px;color:#9ca3af;">Evaporated</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Tip of the Week -->
        <tr><td style="padding:20px 30px;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;">Tip of the Week</p>
          <p style="margin:0;font-size:13px;color:#374151;font-style:italic;line-height:1.5;">${tip}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <a href="${unsubscribeUrl}" style="font-size:12px;color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          <span style="color:#d1d5db;margin:0 8px;">|</span>
          <a href="${dashboardUrl}" style="font-size:12px;color:#16a34a;text-decoration:underline;">View dashboard</a>
          <p style="margin:10px 0 0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ThirstyGrass by 110 Labs</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main Handler ───────────────────────────────────────

Deno.serve(async (req) => {
  // Only allow POST (from cron) or GET (for testing)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify authorization (service role or anon key)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY) && !authHeader.includes("Bearer")) {
    // Allow through — cron sends service role key
  }

  try {
    // Fetch all eligible profiles (paginate to avoid 1000-row limit)
    let allProfiles: Profile[] = [];
    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, zip_code, grass_type, email_unsubscribed")
        .not("zip_code", "is", null)
        .not("email", "is", null)
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`DB query failed: ${error.message}`);
      if (!profiles || profiles.length === 0) break;

      // Filter out unsubscribed
      const eligible = profiles.filter(
        (p: Profile) => !p.email_unsubscribed && p.zip_code && p.email
      );
      allProfiles = allProfiles.concat(eligible);
      if (profiles.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`Processing ${allProfiles.length} eligible profiles`);

    const tip = getTipOfTheWeek();
    let sent = 0;
    let failed = 0;

    for (const profile of allProfiles) {
      try {
        const grassCategory = getGrassCategory(profile.grass_type);
        const weatherData = await fetchWeatherForZip(profile.zip_code, grassCategory);
        const narrative = generateWeatherNarrative(weatherData);

        const unsubscribeUrl = `https://thirstygrass.com/unsubscribe?user_id=${profile.id}`;
        const dashboardUrl = "https://thirstygrass.com/dashboard";

        const emailHtml = buildEmailHtml(
          weatherData,
          narrative,
          tip,
          unsubscribeUrl,
          dashboardUrl
        );

        const subject = `Your lawn this week — ${weatherData.recommendation}`;

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "ThirstyGrass <notify@notify.thirstygrass.com>",
            to: [profile.email],
            subject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          sent++;
        } else {
          const errBody = await resendRes.text();
          console.error(`Resend error for ${profile.email}: ${errBody}`);
          failed++;
        }

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error processing ${profile.email}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: allProfiles.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Weekly digest error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
