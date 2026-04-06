/**
 * Shared recommendation logic — single source of truth for weather-based
 * lawn watering recommendations. Used by calculate-recommendation edge
 * function and daily-weather-job.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────

export interface TuningParams {
  saturation_guard_inches: number;
  saturation_guard_days: number;
  water_threshold: number;
  monitor_threshold: number;
  cool_season_multiplier: number;
  warm_season_multiplier: number;
  mixed_multiplier: number;
}

export const DEFAULT_TUNING: TuningParams = {
  saturation_guard_inches: 0.5,
  saturation_guard_days: 3,
  water_threshold: 0.25,
  monitor_threshold: 0.05,
  cool_season_multiplier: 1.25,
  warm_season_multiplier: 0.75,
  mixed_multiplier: 1.0,
};

export interface ZipWeatherResult {
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

export type SeasonalState = "ACTIVE" | "DORMANT" | "FROST_RISK";
export type SeasonalAlert = "DORMANCY_START" | "DORMANCY_END" | "FROST_INCOMING" | null;

export interface RecommendationResult {
  userId: string;
  recommendation: "WATER" | "MONITOR" | "SKIP";
  alertType: "WATER" | "MONITOR" | "SKIP" | "FROST_INCOMING" | "DORMANCY_START" | "DORMANCY_END" | null;
  isDormant: boolean;
  isFrostRisk: boolean;
  deficit: number;
  personalDeficit: number;
  et_loss_7d: number;
  rain_5d: number;
  forecast_5d: number;
  rain_3d: number;
  avgHigh7d: number;
  forecastLow5d: number;
  shouldSend: boolean;
  grassMultiplier: number;
}

// ── Pure helpers ───────────────────────────────────────

export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

export function getGrassMultiplier(grassType: string, tuning: TuningParams): number {
  if (grassType === "Cool-Season") return tuning.cool_season_multiplier;
  if (grassType === "Warm-Season") return tuning.warm_season_multiplier;
  return tuning.mixed_multiplier;
}

// ── Recommendation logic ──────────────────────────────

export function computeRecommendation(
  rain_3d: number,
  deficit: number,
  tuning: TuningParams,
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

// ── Seasonal state ────────────────────────────────────

export function evaluateSeasonalState(
  avgHigh7d: number,
  forecastLow5d: number,
  grassType: string,
): { seasonalState: SeasonalState; seasonalMessage: string } {
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

export function determineSeasonalAlert(
  currentState: SeasonalState,
  lastAlertSent: string | null,
  lastAlertDate: string | null,
): SeasonalAlert {
  const today = new Date().toISOString().slice(0, 10);

  let daysSinceLastAlert = 999;
  if (lastAlertDate) {
    const last = new Date(lastAlertDate);
    const now = new Date(today);
    daysSinceLastAlert = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (currentState === "FROST_RISK") {
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

// ── Personalization ───────────────────────────────────

export function personalizeForUser(
  cached: ZipWeatherResult,
  grassType: string | null,
  tuning: TuningParams,
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

  const multiplier = getGrassMultiplier(gt, tuning);
  const personalDeficit = cached.et_loss_7d * multiplier - cached.rain_5d - cached.forecast_5d;
  const { recommendation, recommendation_reason } = computeRecommendation(
    cached.rain_3d, personalDeficit, tuning
  );
  return { recommendation, recommendation_reason, deficit: personalDeficit };
}

// ── I/O helpers ───────────────────────────────────────

export async function fetchWithRetry(url: string, retries = 2, backoffMs = 1000): Promise<Response> {
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

export async function getTuningParams(supabase: ReturnType<typeof createClient>): Promise<TuningParams> {
  try {
    const { data } = await supabase.from("admin_settings").select("key, value");
    if (data && data.length > 0) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.key] = row.value;
      return {
        saturation_guard_inches: parseFloat(map.saturation_guard_inches) || DEFAULT_TUNING.saturation_guard_inches,
        saturation_guard_days: parseInt(map.saturation_guard_days) || DEFAULT_TUNING.saturation_guard_days,
        water_threshold: parseFloat(map.water_threshold) || DEFAULT_TUNING.water_threshold,
        monitor_threshold: parseFloat(map.monitor_threshold) || DEFAULT_TUNING.monitor_threshold,
        cool_season_multiplier: parseFloat(map.cool_season_multiplier) || DEFAULT_TUNING.cool_season_multiplier,
        warm_season_multiplier: parseFloat(map.warm_season_multiplier) || DEFAULT_TUNING.warm_season_multiplier,
        mixed_multiplier: parseFloat(map.mixed_multiplier) || DEFAULT_TUNING.mixed_multiplier,
      };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_TUNING };
}

// ── Weather fetch ─────────────────────────────────────

export async function fetchWeatherForZip(
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

  const avgHigh7d = cToF(avgSlice(tempMax, todayIndex - 7, todayIndex));
  const forecastLow5d = cToF(minSlice(tempMin, todayIndex, todayIndex + 5));

  // Default Mixed multiplier for ZIP-level cache
  const deficit = et_loss_7d * tuning.mixed_multiplier - rain_5d - forecast_5d;

  const { recommendation, recommendation_reason } = computeRecommendation(
    rain_3d, deficit, tuning
  );

  return { rain_5d, rain_3d, forecast_5d, forecast_3d, et_loss_7d, deficit, recommendation, recommendation_reason, avgHigh7d, forecastLow5d };
}

// ── High-level recommendation for a single user ──────

export async function getRecommendationForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<RecommendationResult> {
  // 1. Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("zip_code, grass_type, latitude, longitude, email_unsubscribed, last_seasonal_alert_sent, last_seasonal_alert_date")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found for user ${userId}`);
  }
  if (!profile.zip_code) {
    throw new Error(`No ZIP code set for user ${userId}`);
  }

  // 2. Get tuning params
  const tuning = await getTuningParams(supabase);

  // 3. Get weather data (try cache first, fall back to fresh fetch)
  let weather: ZipWeatherResult;
  const { data: cached } = await supabase
    .from("zip_cache")
    .select("rain_5d, forecast_5d, et_loss_7d, deficit, recommendation, recommendation_reason, weather_data, cached_at")
    .eq("zip_code", profile.zip_code)
    .single();

  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  const cacheAge = cached?.cached_at ? Date.now() - new Date(cached.cached_at).getTime() : Infinity;

  if (cached && cacheAge < CACHE_TTL_MS) {
    const wd = cached.weather_data as Record<string, any> | null;
    weather = {
      rain_5d: Number(cached.rain_5d) || 0,
      rain_3d: wd?.precipitation?.day3 || 0,
      forecast_5d: Number(cached.forecast_5d) || 0,
      forecast_3d: wd?.forecast?.day3 || 0,
      et_loss_7d: Number(cached.et_loss_7d) || 0,
      deficit: Number(cached.deficit) || 0,
      recommendation: (cached.recommendation as "WATER" | "MONITOR" | "SKIP") || "SKIP",
      recommendation_reason: cached.recommendation_reason || "",
      avgHigh7d: wd?.avgHigh7d ?? 80,
      forecastLow5d: wd?.forecastLow5d ?? 50,
    };
  } else {
    weather = await fetchWeatherForZip(
      profile.zip_code, tuning, profile.latitude, profile.longitude
    );
  }

  // 4. Personalize for grass type
  const grassType = profile.grass_type || "Mixed";
  const personal = personalizeForUser(weather, grassType, tuning);

  // 5. Seasonal evaluation
  const { seasonalState } = evaluateSeasonalState(weather.avgHigh7d, weather.forecastLow5d, grassType);
  const isDormant = seasonalState === "DORMANT";
  const isFrostRisk = seasonalState === "FROST_RISK";

  const seasonalAlert = determineSeasonalAlert(
    seasonalState,
    profile.last_seasonal_alert_sent,
    profile.last_seasonal_alert_date,
  );

  // 6. Determine alertType
  let alertType: RecommendationResult["alertType"];
  if (seasonalAlert) {
    alertType = seasonalAlert;
  } else if (isDormant || isFrostRisk) {
    alertType = null; // dormant/frost but no new alert to send
  } else {
    alertType = personal.recommendation; // active: WATER/MONITOR/SKIP
  }

  // 7. shouldSend
  const shouldSend = alertType !== null && !profile.email_unsubscribed;

  // 8. Grass multiplier
  const grassMultiplier = getGrassMultiplier(grassType, tuning);

  return {
    userId,
    recommendation: personal.recommendation,
    alertType,
    isDormant,
    isFrostRisk,
    deficit: weather.deficit,
    personalDeficit: personal.deficit,
    et_loss_7d: weather.et_loss_7d,
    rain_5d: weather.rain_5d,
    forecast_5d: weather.forecast_5d,
    rain_3d: weather.rain_3d,
    avgHigh7d: weather.avgHigh7d,
    forecastLow5d: weather.forecastLow5d,
    shouldSend,
    grassMultiplier,
  };
}
