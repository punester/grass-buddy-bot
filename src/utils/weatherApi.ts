import { PrecipitationData } from '@/components/PrecipitationDisplay';

// In a real application, this would call an actual weather API
// For demonstration purposes, we'll simulate a response with random data
export const fetchPrecipitationData = async (address: string): Promise<PrecipitationData> => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Generate random historical precipitation data
      const day1 = Math.random() * 1.5; // 0-1.5 inches for last 24h
      const day3 = day1 + Math.random() * 2; // Additional 0-2 inches for 3 days
      const day5 = day3 + Math.random() * 2; // Additional 0-2 inches for 5 days
      
      // Generate random forecast precipitation data
      const forecastDay1 = Math.random() * 0.7; // 0-0.7 inches for next 24h
      const forecastDay3 = forecastDay1 + Math.random() * 1.5; // Additional 0-1.5 inches for next 3 days
      const forecastDay5 = forecastDay3 + Math.random() * 1.5; // Additional 0-1.5 inches for next 5 days
      
      // Determine when watering is needed (simplified logic)
      // Consider both historical and forecast precipitation
      const totalPrecipitation = day5 + forecastDay5;
      const shouldWater = totalPrecipitation < 2.0;
      
      // Determine recommended watering day (0 = today, 1 = tomorrow, etc.)
      let recommendedWateringDay = 0;
      
      if (shouldWater) {
        if (forecastDay1 > 0.3) {
          // If there's rain coming tomorrow, water today
          recommendedWateringDay = 0;
        } else if (forecastDay3 - forecastDay1 > 0.5) {
          // If there's rain coming in 2-3 days, water tomorrow
          recommendedWateringDay = 1;
        } else {
          // Otherwise, recommend watering 2 days from now
          recommendedWateringDay = 2;
        }
      } else {
        // If no watering needed, set a dummy value
        recommendedWateringDay = -1;
      }
      
      // Get current date/time for "last updated"
      const now = new Date();
      const lastUpdated = now.toLocaleString();
      
      resolve({
        address,
        precipitation: {
          day1,
          day3,
          day5
        },
        forecast: {
          day1: forecastDay1,
          day3: forecastDay3,
          day5: forecastDay5,
          recommendedWateringDay
        },
        shouldWater,
        lastUpdated
      });
    }, 1500); // Simulate 1.5s API delay
  });
};
