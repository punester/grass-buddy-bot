import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropletIcon, 
  CloudRainIcon, 
  InfoIcon, 
  CalendarIcon,
  CheckIcon,
  XIcon,
  AlertTriangleIcon
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
  recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  recommendationReason: string;
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
    if (data.recommendation !== 'WATER') {
      return data.recommendationReason;
    }

    const dayText = (() => {
      switch (data.forecast.recommendedWateringDay) {
        case 0: return 'Water your lawn today.';
        case 1: return 'Water your lawn tomorrow.';
        default: return `Water your lawn in ${data.forecast.recommendedWateringDay} days.`;
      }
    })();

    return dayText;
  };

  const badgeConfig = {
    WATER: {
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
      icon: <DropletIcon className="h-4 w-4 text-blue-800" />,
      label: 'Watering Needed',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
    },
    MONITOR: {
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      icon: <AlertTriangleIcon className="h-4 w-4 text-yellow-800" />,
      label: 'Monitor',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-600',
    },
    SKIP: {
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
      icon: <CheckIcon className="h-4 w-4 text-green-800" />,
      label: 'No Watering Needed',
      textColor: 'text-green-700',
      iconColor: 'text-green-600',
    },
  };

  const badge = badgeConfig[data.recommendation];

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
            <h2 className="text-2xl font-bold text-foreground mb-2">Watering Recommendation</h2>
            <div className="flex items-center">
              <Badge 
                variant="outline"
                className={cn(
                  "text-sm py-1 px-3 gap-1 font-medium rounded-full",
                  badge.className
                )}
              >
                {badge.icon}
                {badge.label}
              </Badge>
              <span className="text-muted-foreground text-sm ml-4">
                Last updated: {data.lastUpdated}
              </span>
            </div>
          </div>

          <Card className="p-6 mb-6 border border-border bg-card rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center">
                <CalendarIcon className={cn("mr-2 h-5 w-5", badge.iconColor)} />
                <h3 className="text-xl font-semibold text-foreground">Recommendation</h3>
              </div>
            </div>
            
            <div className="mb-5 pb-5 border-b border-border">
              <div className={cn("text-xl font-semibold", badge.textColor)}>
                {getRecommendationText()}
              </div>
              <p className="text-muted-foreground mt-2">
                {data.recommendationReason}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  Historical Precipitation
                </h4>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last 24 hours:</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.precipitation.day1)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last 3 days:</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.precipitation.day3)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last 5 days:</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.precipitation.day5)}"</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  Precipitation Forecast
                </h4>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next 24 hours ({getFormattedDate(1)}):</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.forecast.day1)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next 3 days:</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.forecast.day3)}"</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next 5 days:</span>
                    <span className="font-medium text-foreground">{formatPrecipitation(data.forecast.day5)}"</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
          
          <div className="flex items-center text-foreground mb-4">
            <InfoIcon className="h-4 w-4 mr-2 text-muted-foreground" />
            <p className="text-sm">
              Data is specific to your address: <span className="font-medium">{data.address}</span>
            </p>
          </div>

          <Card className="p-6 border border-border bg-card rounded-xl shadow-sm">
            <div className="flex items-center mb-4">
              <DropletIcon className="mr-2 h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Understanding Our Recommendation</h3>
            </div>
            
            <p className="text-muted-foreground mb-4">
              Our recommendation factors in historical rainfall, forecast precipitation, and evapotranspiration (ET)
              losses for your location. We also adjust for your grass type — cool-season grasses need more water
              than warm-season varieties.
            </p>
            
            <div className="bg-primary/5 rounded-lg p-4">
              <h4 className="font-medium text-primary mb-2">How We Determine Watering Needs:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>We analyze the past 5 days of precipitation data</li>
                <li>We factor in the forecast for the next 5 days</li>
                <li>We account for evapotranspiration (ET) moisture loss over 7 days</li>
                <li>We adjust for your grass type's water requirements</li>
                <li>We calculate the optimal watering day based on expected rainfall</li>
              </ul>
            </div>
          </Card>
        </div>
        
        <div className="w-full md:w-1/3 mt-6 md:mt-0">
          <EmailNotificationForm 
            address={data.address} 
            recommendation={data.recommendation}
            recommendedWateringDay={data.forecast.recommendedWateringDay} 
          />
        </div>
      </div>
    </div>
  );
};

export default PrecipitationDisplay;
