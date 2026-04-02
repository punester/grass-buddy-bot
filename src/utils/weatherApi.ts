import { PrecipitationData } from '@/components/PrecipitationDisplay';

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
 */
export const fetchPrecipitationData = async (zipCode: string): Promise<PrecipitationData> => {
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

  // Step 2 — Fetch weather data (7 past + 7 forecast days)
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=7&forecast_days=7&timezone=auto`
  );
  if (!weatherRes.ok) {
    throw new Error(`Weather data request failed (${weatherRes.status})`);
  }
  const weatherData = await weatherRes.json();
  const daily: OpenMeteoDaily = weatherData.daily;

  if (!daily || !daily.time || !daily.precipitation_sum) {
    throw new Error('Unexpected weather API response format');
  }

  // The response contains past_days + forecast_days entries.
  // past_days=7 means indices 0-6 are past days (oldest first), index 7 is today.
  // forecast_days=7 means indices 7-13 are today + next 6 days.
  const totalDays = daily.time.length; // should be 14
  const todayIndex = 7; // past_days count

  // Helper to safely sum a slice of precipitation values
  const sumSlice = (arr: number[], start: number, end: number): number => {
    let sum = 0;
    for (let i = Math.max(0, start); i < Math.min(arr.length, end); i++) {
      sum += arr[i] ?? 0;
    }
    return sum;
  };

  const precip = daily.precipitation_sum;
  const et = daily.et0_fao_evapotranspiration;

  // Step 3 — Map into PrecipitationData
  // Past precipitation (looking back from today, not including today)
  const precipDay1 = sumSlice(precip, todayIndex - 1, todayIndex);
  const precipDay3 = sumSlice(precip, todayIndex - 3, todayIndex);
  const precipDay5 = sumSlice(precip, todayIndex - 5, todayIndex);

  // Forecast precipitation (today + future days)
  const forecastDay1 = sumSlice(precip, todayIndex, todayIndex + 1);
  const forecastDay3 = sumSlice(precip, todayIndex, todayIndex + 3);
  const forecastDay5 = sumSlice(precip, todayIndex, todayIndex + 5);

  // Step 4 — ET loss for past 7 days
  const etLoss7d = sumSlice(et, todayIndex - 7, todayIndex);

  // Watering logic: compare recent + upcoming precipitation to ET demand
  const totalRecent = precipDay5 + forecastDay5;
  const shouldWater = totalRecent < 2.0;

  let recommendedWateringDay = -1;
  if (shouldWater) {
    if (forecastDay1 > 0.3) {
      recommendedWateringDay = 0;
    } else if (forecastDay3 - forecastDay1 > 0.5) {
      recommendedWateringDay = 1;
    } else {
      recommendedWateringDay = 2;
    }
  }

  return {
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
    shouldWater,
    lastUpdated: new Date().toLocaleString(),
    etLoss7d,
  };
};
