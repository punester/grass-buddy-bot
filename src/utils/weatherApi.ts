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

/**
 * Fetches real precipitation data from Open-Meteo for a given US ZIP code.
 * Uses zip_cache to avoid redundant API calls (24h TTL).
 * Logs each lookup to zip_lookup_log.
 * @param zipCode - 5-digit US ZIP code
 * @param grassType - Optional grass type for recommendation tuning
 * @param userId - Optional user ID for logging (null for anonymous)
 */
export const fetchPrecipitationData = async (
  zipCode: string,
  grassType: string = 'Mixed',
  userId?: string | null
): Promise<PrecipitationData> => {
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
        // Cache hit — increment lookup count
        await supabase.rpc('increment_cache_lookup', { p_zip_code: zipCode });

        const cachedData = cached.weather_data as unknown as PrecipitationData;
        
        // Re-compute recommendation with current grassType
        const grassMultiplier =
          grassType === 'Cool-Season' ? 1.25 :
          grassType === 'Warm-Season' ? 0.75 : 1.0;
        const weeklyNeed = 1.0 * grassMultiplier;
        const deficit = weeklyNeed + cachedData.etLoss7d - cachedData.precipitation.day5 - cachedData.forecast.day5;

        let recommendation: 'WATER' | 'MONITOR' | 'SKIP';
        let recommendationReason: string;

        if (deficit > 0.5) {
          recommendation = 'WATER';
          recommendationReason = "Your lawn needs water — rainfall and forecast aren't enough to cover evaporation losses.";
        } else if (deficit > 0) {
          recommendation = 'MONITOR';
          recommendationReason = "You're borderline. Skip today and check again tomorrow.";
        } else {
          recommendation = 'SKIP';
          recommendationReason = 'Rain has you covered. No watering needed this week.';
        }

        const result: PrecipitationData = {
          ...cachedData,
          recommendation,
          recommendationReason,
          weeklyNeed,
          deficit,
          grassType,
        };

        // Log the lookup
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

  // Past precipitation
  const precipDay1 = sumSlice(precip, todayIndex - 1, todayIndex);
  const precipDay3 = sumSlice(precip, todayIndex - 3, todayIndex);
  const precipDay5 = sumSlice(precip, todayIndex - 5, todayIndex);

  // Forecast precipitation
  const forecastDay1 = sumSlice(precip, todayIndex, todayIndex + 1);
  const forecastDay3 = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecastDay5 = sumSlice(precip, todayIndex, todayIndex + 5);

  // ET loss for past 7 days
  const etLoss7d = sumSlice(et, todayIndex - 7, todayIndex) / 25.4;

  // Step 3 — 3-state recommendation logic
  const grassMultiplier =
    grassType === 'Cool-Season' ? 1.25 :
    grassType === 'Warm-Season' ? 0.75 : 1.0;

  const weeklyNeed = 1.0 * grassMultiplier;
  const rainReceived = precipDay5;
  const rainComing = forecastDay5;
  const etLoss = etLoss7d;
  const deficit = weeklyNeed + etLoss - rainReceived - rainComing;

  let recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  let recommendationReason: string;

  if (deficit > 0.5) {
    recommendation = 'WATER';
    recommendationReason = "Your lawn needs water — rainfall and forecast aren't enough to cover evaporation losses.";
  } else if (deficit > 0) {
    recommendation = 'MONITOR';
    recommendationReason = "You're borderline. Skip today and check again tomorrow.";
  } else {
    recommendation = 'SKIP';
    recommendationReason = 'Rain has you covered. No watering needed this week.';
  }

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
    // Non-critical: don't fail the request if caching fails
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
