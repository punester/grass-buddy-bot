import { PrecipitationData } from '@/components/PrecipitationDisplay';
import { supabase } from '@/integrations/supabase/client';

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
}

interface OpenMeteoDaily {
  time: string[];
  precipitation_sum: number[];
  et0_fao_evapotranspiration: number[];
}

// --- Admin tuning parameters (module-scope cache) ---
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

let cachedTuning: TuningParams | null = null;

async function getTuningParams(): Promise<TuningParams> {
  if (cachedTuning) return cachedTuning;
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value');
    if (data && data.length > 0) {
      const map: Record<string, string> = {};
      for (const row of data) {
        map[row.key] = row.value;
      }
      cachedTuning = {
        saturation_guard_inches: parseFloat(map.saturation_guard_inches) || DEFAULTS.saturation_guard_inches,
        saturation_guard_days: parseInt(map.saturation_guard_days) || DEFAULTS.saturation_guard_days,
        water_threshold: parseFloat(map.water_threshold) || DEFAULTS.water_threshold,
        monitor_threshold: parseFloat(map.monitor_threshold) || DEFAULTS.monitor_threshold,
        cool_season_multiplier: parseFloat(map.cool_season_multiplier) || DEFAULTS.cool_season_multiplier,
        warm_season_multiplier: parseFloat(map.warm_season_multiplier) || DEFAULTS.warm_season_multiplier,
        mixed_multiplier: parseFloat(map.mixed_multiplier) || DEFAULTS.mixed_multiplier,
      };
      return cachedTuning;
    }
  } catch {
    // fall through to defaults
  }
  cachedTuning = { ...DEFAULTS };
  return cachedTuning;
}

/** Clear the cached tuning params (e.g. after admin saves new values) */
export function clearTuningCache() {
  cachedTuning = null;
}

// --- Recommendation logic helper ---
function computeRecommendation(
  precipDay3: number,
  precipDay5: number,
  forecastDay5: number,
  etLoss7d: number,
  grassType: string,
  tuning: TuningParams,
) {
  const grassMultiplier =
    grassType === 'Cool-Season' ? tuning.cool_season_multiplier :
    grassType === 'Warm-Season' ? tuning.warm_season_multiplier :
    tuning.mixed_multiplier;

  const adjustedTarget = etLoss7d * grassMultiplier;
  const weeklyNeed = adjustedTarget;
  const deficit = adjustedTarget - precipDay5 - forecastDay5;

  let recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  let recommendationReason: string;

  if (precipDay3 > tuning.saturation_guard_inches) {
    recommendation = 'SKIP';
    recommendationReason =
      'Soil is likely saturated from recent rainfall. No watering needed right now.';
  } else if (deficit > tuning.water_threshold) {
    recommendation = 'WATER';
    recommendationReason =
      "Your lawn needs water — recent rainfall and forecast aren't enough to offset evaporation losses.";
  } else if (deficit > tuning.monitor_threshold) {
    recommendation = 'MONITOR';
    recommendationReason =
      "You're borderline. Skip today and check again tomorrow — conditions may resolve on their own.";
  } else {
    recommendation = 'SKIP';
    recommendationReason =
      'Rain and forecast precipitation have your lawn covered. No watering needed this week.';
  }

  return { recommendation, recommendationReason, weeklyNeed, deficit, grassMultiplier };
}

/**
 * Fetches real precipitation data from Open-Meteo for a given US ZIP code.
 */
export const fetchPrecipitationData = async (
  zipCode: string,
  grassType: string = 'Mixed',
  userId?: string | null
): Promise<PrecipitationData> => {
  const tuning = await getTuningParams();

  // Check cache first
  try {
    const { data: cached } = await supabase
      .from('zip_cache')
      .select('weather_data, cached_at')
      .eq('zip_code', zipCode)
      .single();

    if (cached) {
      const cachedAt = new Date(cached.cached_at);
      const now = new Date();
      const hoursSinceCached = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCached < 24) {
        await supabase.rpc('increment_cache_lookup', { p_zip_code: zipCode });

        const cachedData = cached.weather_data as unknown as PrecipitationData;

        const { recommendation, recommendationReason, weeklyNeed, deficit } =
          computeRecommendation(
            cachedData.precipitation.day3,
            cachedData.precipitation.day5,
            cachedData.forecast.day5,
            cachedData.etLoss7d,
            grassType,
            tuning,
          );

        const result: PrecipitationData = {
          ...cachedData,
          recommendation,
          recommendationReason,
          weeklyNeed,
          deficit,
          grassType,
        };

        await supabase.rpc('log_zip_lookup', {
          p_zip_code: zipCode,
          p_recommendation: recommendation,
          p_user_id: userId ?? null,
        });

        return result;
      }
    }
  } catch {
    // Cache miss or error — proceed to fetch
  }

  // Step 1 — ZIP to coordinates
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zipCode)}&count=1&country=US&format=json`
  );
  if (!geoRes.ok) {
    throw new Error(`Geocoding request failed (${geoRes.status})`);
  }
  const geoData = await geoRes.json();
  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`Could not find a location for ZIP code "${zipCode}"`);
  }
  const { latitude, longitude, name, admin1 } = geoData.results[0] as GeoResult;
  const locationLabel = admin1 ? `${name}, ${admin1}` : name;

  // Step 2 — Fetch weather data
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=7&forecast_days=7&timezone=auto&precipitation_unit=inch`
  );
  if (!weatherRes.ok) {
    throw new Error(`Weather data request failed (${weatherRes.status})`);
  }
  const weatherData = await weatherRes.json();
  const daily: OpenMeteoDaily = weatherData.daily;

  if (!daily || !daily.time || !daily.precipitation_sum) {
    throw new Error('Unexpected weather API response format');
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

  const precipDay1 = sumSlice(precip, todayIndex - 1, todayIndex);
  const precipDay3 = sumSlice(precip, todayIndex - 3, todayIndex);
  const precipDay5 = sumSlice(precip, todayIndex - 5, todayIndex);

  const forecastDay1 = sumSlice(precip, todayIndex, todayIndex + 1);
  const forecastDay3 = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecastDay5 = sumSlice(precip, todayIndex, todayIndex + 5);

  const etLoss7d = sumSlice(et, todayIndex - 7, todayIndex) / 25.4;

  const { recommendation, recommendationReason, weeklyNeed, deficit } =
    computeRecommendation(precipDay3, precipDay5, forecastDay5, etLoss7d, grassType, tuning);

  // Recommended watering day only when WATER
  let recommendedWateringDay = -1;
  if (recommendation === 'WATER') {
    if (forecastDay1 > 0.3) {
      recommendedWateringDay = 0;
    } else if (forecastDay3 - forecastDay1 > 0.5) {
      recommendedWateringDay = 1;
    } else {
      recommendedWateringDay = 2;
    }
  }

  const result: PrecipitationData = {
    address: `${locationLabel} (${zipCode})`,
    precipitation: {
      day1: precipDay1,
      day3: precipDay3,
      day5: precipDay5,
    },
    forecast: {
      day1: forecastDay1,
      day3: forecastDay3,
      day5: forecastDay5,
      recommendedWateringDay,
    },
    recommendation,
    recommendationReason,
    lastUpdated: new Date().toLocaleString(),
    etLoss7d,
    weeklyNeed,
    deficit,
    grassType,
  };

  // Cache the result
  try {
    await supabase.rpc('upsert_zip_cache', {
      p_zip_code: zipCode,
      p_weather_data: JSON.parse(JSON.stringify(result)),
    });
  } catch {
    // Non-critical
  }

  // Log the lookup
  try {
    await supabase.rpc('log_zip_lookup', {
      p_zip_code: zipCode,
      p_recommendation: recommendation,
      p_user_id: userId ?? null,
    });
  } catch {
    // Non-critical
  }

  return result;
};
