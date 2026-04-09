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
  temperature_2m_max: number[];
  temperature_2m_min: number[];
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

// --- Celsius to Fahrenheit ---
function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

// --- Seasonal state evaluation ---
function evaluateSeasonalState(
  avgHigh7d: number,
  forecastLow5d: number,
  grassType: string,
): { seasonalState: 'ACTIVE' | 'DORMANT' | 'FROST_RISK'; seasonalMessage: string } {
  const dormancyThreshold =
    grassType === 'Cool-Season' ? 45 :
    grassType === 'Warm-Season' ? 55 :
    50;

  if (forecastLow5d <= 34) {
    return {
      seasonalState: 'FROST_RISK',
      seasonalMessage: 'Frost expected in the next 5 days. Avoid watering — frozen water in soil can damage roots.',
    };
  }

  if (avgHigh7d < dormancyThreshold) {
    return {
      seasonalState: 'DORMANT',
      seasonalMessage: `Your lawn is dormant — 7-day average high is ${Math.round(avgHigh7d)}°F, below the ${dormancyThreshold}°F threshold for your grass type. Watering now won't help and may cause harm.`,
    };
  }

  return { seasonalState: 'ACTIVE', seasonalMessage: '' };
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

        // Re-evaluate seasonal state for this grass type
        const avgHigh7d = cachedData.avgHigh7d ?? 80;
        const forecastLow5d = cachedData.forecastLow5d ?? 50;
        const { seasonalState, seasonalMessage } = evaluateSeasonalState(avgHigh7d, forecastLow5d, grassType);

        let recommendation: 'WATER' | 'MONITOR' | 'SKIP';
        let recommendationReason: string;
        let weeklyNeed = cachedData.weeklyNeed;
        let deficit = cachedData.deficit;

        if (seasonalState !== 'ACTIVE') {
          recommendation = 'SKIP';
          recommendationReason = seasonalMessage;
          weeklyNeed = 0;
          deficit = 0;
        } else {
          const computed = computeRecommendation(
            cachedData.precipitation.day3,
            cachedData.precipitation.day5,
            cachedData.forecast.day5,
            cachedData.etLoss7d,
            grassType,
            tuning,
          );
          recommendation = computed.recommendation;
          recommendationReason = computed.recommendationReason;
          weeklyNeed = computed.weeklyNeed;
          deficit = computed.deficit;
        }

        const result: PrecipitationData = {
          ...cachedData,
          recommendation,
          recommendationReason,
          weeklyNeed,
          deficit,
          grassType,
          avgHigh7d,
          forecastLow5d,
          seasonalState,
          seasonalMessage,
          seasonalAlert: seasonalState === 'FROST_RISK' ? 'FROST_INCOMING' : null,
        };

        await supabase.rpc('log_zip_lookup', {
          p_zip_code: zipCode,
          p_recommendation: recommendation,
          p_user_id: userId ?? null,
        });

        // Write recommendation_history for authenticated users (cache hit)
        if (userId) {
          try {
            const todayDate = new Date().toISOString().slice(0, 10);
            await supabase.from('recommendation_history' as any).upsert({
              user_id: userId,
              date: todayDate,
              recommendation,
              alert_type: result.seasonalAlert,
              deficit,
              et_loss_7d: cachedData.etLoss7d,
              rain_5d: cachedData.precipitation.day5,
              forecast_5d: cachedData.forecast.day5,
              avg_high_7d: avgHigh7d,
              forecast_low_5d: forecastLow5d,
              source: 'manual',
            }, { onConflict: 'user_id,date' });
          } catch {
            // Non-critical
          }
        }

        return result;
      }
    }
  } catch {
    // Cache miss or error — proceed to fetch
  }

  // Step 1 — ZIP to coordinates via zippopotam.us (reliable US ZIP lookup)
  const geoRes = await fetch(
    `https://api.zippopotam.us/us/${encodeURIComponent(zipCode)}`
  );
  if (!geoRes.ok) {
    throw new Error(`Could not find a location for ZIP code "${zipCode}"`);
  }
  const geoData = await geoRes.json();
  const place = geoData?.places?.[0];
  if (!place) {
    throw new Error(`Could not find a location for ZIP code "${zipCode}"`);
  }
  const latitude = parseFloat(place.latitude);
  const longitude = parseFloat(place.longitude);
  const locationLabel = `${place['place name']}, ${place['state abbreviation']}`;

  // Step 2 — Fetch weather data (now includes temperature)
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min&past_days=7&forecast_days=7&timezone=auto&precipitation_unit=inch`
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

  const avgSlice = (arr: number[], start: number, end: number): number => {
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      if (arr[i] != null) {
        sum += arr[i];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  const minSlice = (arr: number[], start: number, end: number): number => {
    let min = Infinity;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      if (arr[i] != null && arr[i] < min) {
        min = arr[i];
      }
    }
    return min === Infinity ? 0 : min;
  };

  const precip = daily.precipitation_sum;
  const et = daily.et0_fao_evapotranspiration;
  const tempMax = daily.temperature_2m_max;
  const tempMin = daily.temperature_2m_min;

  const precipDay1 = sumSlice(precip, todayIndex - 1, todayIndex);
  const precipDay3 = sumSlice(precip, todayIndex - 3, todayIndex);
  const precipDay5 = sumSlice(precip, todayIndex - 5, todayIndex);

  const forecastDay1 = sumSlice(precip, todayIndex, todayIndex + 1);
  const forecastDay3 = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecastDay5 = sumSlice(precip, todayIndex, todayIndex + 5);

  const etLoss7d = sumSlice(et, todayIndex - 7, todayIndex) / 25.4;

  // Temperature calculations
  const avgHigh7dC = avgSlice(tempMax, todayIndex - 7, todayIndex);
  const forecastLow5dC = minSlice(tempMin, todayIndex, todayIndex + 5);
  const avgHigh7d = cToF(avgHigh7dC);
  const forecastLow5d = cToF(forecastLow5dC);

  // Evaluate seasonal state BEFORE deficit logic
  const { seasonalState, seasonalMessage } = evaluateSeasonalState(avgHigh7d, forecastLow5d, grassType);

  let recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  let recommendationReason: string;
  let weeklyNeed: number;
  let deficit: number;
  let recommendedWateringDay = -1;

  if (seasonalState !== 'ACTIVE') {
    // Dormant or frost risk — skip deficit entirely
    recommendation = 'SKIP';
    recommendationReason = seasonalMessage;
    weeklyNeed = 0;
    deficit = 0;
  } else {
    // Normal deficit logic
    const computed = computeRecommendation(precipDay3, precipDay5, forecastDay5, etLoss7d, grassType, tuning);
    recommendation = computed.recommendation;
    recommendationReason = computed.recommendationReason;
    weeklyNeed = computed.weeklyNeed;
    deficit = computed.deficit;

    // Recommended watering day only when WATER
    if (recommendation === 'WATER') {
      if (forecastDay1 > 0.3) {
        recommendedWateringDay = 0;
      } else if (forecastDay3 - forecastDay1 > 0.5) {
        recommendedWateringDay = 1;
      } else {
        recommendedWateringDay = 2;
      }
    }
  }

  // Seasonal alert flags (no sending logic yet)
  let seasonalAlert: 'DORMANCY_START' | 'DORMANCY_END' | 'FROST_INCOMING' | null = null;
  if (seasonalState === 'FROST_RISK') {
    seasonalAlert = 'FROST_INCOMING';
  }
  // For DORMANCY_START / DORMANCY_END we'd need yesterday's state comparison;
  // storing the flag on the result for future email/SMS use
  // (a more complete implementation would compare against cached previous state)

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
    avgHigh7d,
    forecastLow5d,
    seasonalState,
    seasonalMessage,
    seasonalAlert,
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

  // Write recommendation_history for authenticated users
  if (userId) {
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      await supabase.from('recommendation_history' as any).upsert({
        user_id: userId,
        date: todayDate,
        recommendation,
        alert_type: seasonalAlert,
        deficit,
        et_loss_7d: etLoss7d,
        rain_5d: precipDay5,
        forecast_5d: forecastDay5,
        avg_high_7d: avgHigh7d,
        forecast_low_5d: forecastLow5d,
        source: 'manual',
      }, { onConflict: 'user_id,date' });
    } catch {
      // Non-critical
    }
  }

  return result;
};
