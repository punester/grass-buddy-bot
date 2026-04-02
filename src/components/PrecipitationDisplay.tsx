import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropletIcon, 
  CloudRainIcon, 
  InfoIcon, 
  CalendarIcon,
  CheckIcon,
  XIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailNotificationForm from './EmailNotificationForm';

export interface PrecipitationData {
  address: string;
  precipitation: {
    day1: number;
    day3: number;
    day5: number;
  };
  forecast: {
    day1: number;
    day3: number;
    day5: number;
    recommendedWateringDay: number;
  };
  shouldWater: boolean;
  lastUpdated: string;
  etLoss7d: number;
}

interface PrecipitationDisplayProps {
  data: PrecipitationData;
}

const PrecipitationDisplay: React.FC<PrecipitationDisplayProps> = ({ data }) => {
  const formatPrecipitation = (inches: number): string => {
    return inches.toFixed(2);
  };

  const getRecommendationText = (): string => {
    if (!data.shouldWater) {
      return "Your lawn doesn't need watering at this time.";
    }

    switch (data.forecast.recommendedWateringDay) {
      case 0:
        return "Water your lawn today.";
      case 1:
        return "Water your lawn tomorrow.";
      default:
        return `Water your lawn in ${data.forecast.recommendedWateringDay} days.`;
    }
  };

  const getFormattedDate = (daysFromNow: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="w-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Watering Recommendation</h2>
            <div className="flex items-center">
              <Badge 
                variant={data.shouldWater ? "default" : "outline"}
                className={cn(
                  "text-sm py-1 px-3 gap-1 font-medium rounded-full",
                  data.shouldWater 
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-100" 
                    : "bg-green-100 text-green-800 hover:bg-green-100"
                )}
              >
                {data.shouldWater 
                  ? <DropletIcon className="h-4 w-4 text-blue-800" /> 
                  : <CheckIcon className="h-4 w-4 text-green-800" />
                }
                {data.shouldWater ? "Watering Needed" : "No Watering Needed"}
              </Badge>
              <span className="text-gray-500 text-sm ml-4">
                Last updated: {data.lastUpdated}
              </span>
            </div>
          </div>

          <Card className="p-6 mb-6 border border-gray-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center">
                <CalendarIcon className={cn(
                  "mr-2 h-5 w-5",
                  data.shouldWater ? "text-blue-600" : "text-green-600"
                )} />
                <h3 className="text-xl font-semibold text-gray-900">Recommendation</h3>
              </div>
            </div>
            
            <div className="mb-5 pb-5 border-b border-gray-100">
              <div className={cn(
                "text-xl font-semibold",
                data.shouldWater ? "text-blue-700" : "text-green-700"
              )}>
                {getRecommendationText()}
              </div>
              <p className="text-gray-600 mt-2">
                This recommendation is based on past precipitation data and weather forecast for your location.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                  Historical Precipitation
                </h4>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Last 24 hours:</span>
                    <span className="font-medium">{formatPrecipitation(data.precipitation.day1)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Last 3 days:</span>
                    <span className="font-medium">{formatPrecipitation(data.precipitation.day3)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Last 5 days:</span>
                    <span className="font-medium">{formatPrecipitation(data.precipitation.day5)}"</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                  Precipitation Forecast
                </h4>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Next 24 hours ({getFormattedDate(1)}):</span>
                    <span className="font-medium">{formatPrecipitation(data.forecast.day1)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Next 3 days:</span>
                    <span className="font-medium">{formatPrecipitation(data.forecast.day3)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600">Next 5 days:</span>
                    <span className="font-medium">{formatPrecipitation(data.forecast.day5)}"</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
          
          <div className="flex items-center text-gray-700 mb-4">
            <InfoIcon className="h-4 w-4 mr-2 text-gray-500" />
            <p className="text-sm">
              Data is specific to your address: <span className="font-medium">{data.address}</span>
            </p>
          </div>

          <Card className="p-6 border border-gray-200 bg-white rounded-xl shadow-sm">
            <div className="flex items-center mb-4">
              <DropletIcon className="mr-2 h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Understanding Our Recommendation</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Our recommendation factors in both historical rainfall data for your location and the precipitation
              forecast for the coming days. Generally, lawns need about 1-1.5 inches of water per week, either from
              rainfall or irrigation.
            </p>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">How We Determine Watering Needs:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                <li>We analyze the past 5 days of precipitation data</li>
                <li>We factor in the forecast for the next 5 days</li>
                <li>We calculate the optimal watering day based on expected rainfall</li>
                <li>We update our recommendation daily with fresh data</li>
              </ul>
            </div>
          </Card>
        </div>
        
        <div className="w-full md:w-1/3 mt-6 md:mt-0">
          <EmailNotificationForm 
            address={data.address} 
            shouldWater={data.shouldWater} 
            recommendedWateringDay={data.forecast.recommendedWateringDay} 
          />
        </div>
      </div>
    </div>
  );
};

export default PrecipitationDisplay;
