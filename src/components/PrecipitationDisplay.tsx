import React from 'react';
import { Card } from '@/components/ui/card';
import { 
  DropletIcon, 
  InfoIcon, 
  CheckCircle2Icon,
  AlertTriangleIcon,
  SnowflakeIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailNotificationForm from './EmailNotificationForm';
import { useAuth } from '@/contexts/AuthContext';

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
  weeklyNeed: number;
  deficit: number;
  grassType: string;
  avgHigh7d?: number;
  forecastLow5d?: number;
  seasonalState?: 'ACTIVE' | 'DORMANT' | 'FROST_RISK';
  seasonalMessage?: string;
  seasonalAlert?: 'DORMANCY_START' | 'DORMANCY_END' | 'FROST_INCOMING' | null;
}

interface PrecipitationDisplayProps {
  data: PrecipitationData;
  zipCode?: string;
}

const PrecipitationDisplay: React.FC<PrecipitationDisplayProps> = ({ data, zipCode }) => {
  const { user } = useAuth();
  const formatPrecipitation = (inches: number | undefined): string => {
    return (inches ?? 0).toFixed(2);
  };

  const isDormant = data.seasonalState === 'DORMANT' || data.seasonalState === 'FROST_RISK';

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

  const bannerConfig = {
    WATER: {
      bg: 'bg-[#dc2626]',
      icon: <DropletIcon className="h-10 w-10 text-white animate-[drip_1.5s_ease-in-out_infinite]" />,
      label: 'WATER',
      reasonColor: 'text-[#dc2626]',
    },
    MONITOR: {
      bg: 'bg-[#d97706]',
      icon: <AlertTriangleIcon className="h-10 w-10 text-white animate-[pulse-icon_2s_ease-in-out_infinite]" />,
      label: 'MONITOR',
      reasonColor: 'text-[#d97706]',
    },
    SKIP: {
      bg: 'bg-[#16a34a]',
      icon: <CheckCircle2Icon className="h-10 w-10 text-white animate-[bounce-once_0.6s_ease-out]" />,
      label: 'SKIP',
      reasonColor: 'text-[#16a34a]',
    },
  };

  const getDormancyThreshold = (): number => {
    if (data.grassType === 'Cool-Season') return 45;
    if (data.grassType === 'Warm-Season') return 55;
    return 50;
  };

  const getFormattedDate = (daysFromNow: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Dormant / Frost Risk card
  if (isDormant) {
    const isFrost = data.seasonalState === 'FROST_RISK';
    return (
      <>
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="w-full">
              <h2 className="text-2xl font-bold text-foreground mb-4">Watering Recommendation</h2>

              <Card className="mb-6 border rounded-xl shadow-sm overflow-hidden"
                style={{ borderColor: '#d1d5db', backgroundColor: '#f3f4f6' }}>
                {/* Status Banner */}
                <div className={cn(
                  "px-6 py-8 flex flex-col items-center text-white",
                  isFrost ? "bg-[#93c5fd]" : "bg-[#9ca3af]"
                )}>
                  <span className="text-4xl mb-2">{isFrost ? '❄️' : '🌾'}</span>
                  <span className="text-[2rem] font-bold tracking-wide text-gray-800">
                    {isFrost ? 'FROST RISK' : 'DORMANT'}
                  </span>
                  <span className="text-gray-600 text-sm mt-1">Last updated: {data.lastUpdated}</span>
                </div>

                {/* Explanation */}
                <div className="px-6 pt-5 pb-6">
                  <p className="text-lg font-semibold text-gray-700 mb-4">
                    {isFrost
                      ? 'Freezing temps are forecast in the next 5 days.'
                      : 'Your lawn is resting for the season.'}
                  </p>

                  <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>7-day average high: <strong>{Math.round(data.avgHigh7d ?? 0)}°F</strong></li>
                      {!isFrost && (
                        <li>Dormancy threshold for {data.grassType} grass: <strong>{getDormancyThreshold()}°F</strong></li>
                      )}
                      <li>Forecast low this week: <strong>{Math.round(data.forecastLow5d ?? 0)}°F</strong></li>
                    </ul>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">
                    {isFrost
                      ? 'Skip watering until the frost window passes — water in the soil can freeze and damage grass roots.'
                      : "Watering during dormancy won't help growth and can cause root damage if temps drop further. We'll alert you when conditions signal it's time to start watering again."}
                  </p>
                </div>

                {/* Data Grid — muted */}
                <div className="px-6 pb-6 pt-2 opacity-50">
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
                </div>
              </Card>

              <div className="flex items-center text-foreground mb-4">
                <InfoIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm">
                  Data is specific to your address: <span className="font-medium">{data.address}</span>
                </p>
              </div>
            </div>

            {!user && (
              <div className="w-full md:w-1/3 mt-6 md:mt-0">
                <EmailNotificationForm 
                  address={data.address} 
                  recommendation={data.recommendation}
                  recommendedWateringDay={data.forecast.recommendedWateringDay}
                  weatherData={data}
                  zipCode={zipCode}
                />
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Normal ACTIVE state rendering
  const banner = bannerConfig[data.recommendation];

  return (
    <>
      <style>{`
        @keyframes drip {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes bounce-once {
          0% { transform: scale(0.5) translateY(10px); opacity: 0; }
          60% { transform: scale(1.15) translateY(-4px); opacity: 1; }
          80% { transform: scale(0.95) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
      `}</style>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-foreground mb-4">Watering Recommendation</h2>

            <Card className="mb-6 border border-border bg-card rounded-xl shadow-sm overflow-hidden">
              {/* Status Banner */}
              <div className={cn("px-6 py-8 flex flex-col items-center text-white", banner.bg)}>
                {banner.icon}
                <span className="text-[2rem] font-bold tracking-wide mt-2">{banner.label}</span>
                <span className="text-white/70 text-sm mt-1">Last updated: {data.lastUpdated}</span>
              </div>

              {/* Reason */}
              <div className="px-6 pt-5 pb-2">
                <p className={cn("text-[1.25rem] font-bold", banner.reasonColor)}>
                  {getRecommendationText()}
                </p>
              </div>

              {/* Data Grid */}
              <div className="px-6 pb-6 pt-4">
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
                  <li>Past 5 days of precipitation: {formatPrecipitation(data.precipitation.day5)}" received</li>
                  <li>Next 5 days forecast: {formatPrecipitation(data.forecast.day5)}" expected</li>
                  <li>Evapotranspiration loss (7 days): {formatPrecipitation(data.etLoss7d)}" lost to evaporation</li>
                  <li>Weekly water need for {data.grassType} grass: {formatPrecipitation(data.weeklyNeed)}"</li>
                  <li>Calculated deficit: {formatPrecipitation(data.deficit)}" ({(data.deficit ?? 0) > 0.25 ? 'WATER if > 0.25"' : (data.deficit ?? 0) > 0.05 ? 'MONITOR if 0.05–0.25"' : 'SKIP if < 0.05"'})</li>
                  {data.avgHigh7d != null && (
                    <li>7-day avg high: {Math.round(data.avgHigh7d)}°F | Forecast low: {Math.round(data.forecastLow5d ?? 0)}°F — Season: {data.seasonalState}</li>
                  )}
                </ul>
              </div>
            </Card>
          </div>
          
          {!user && (
            <div className="w-full md:w-1/3 mt-6 md:mt-0">
              <EmailNotificationForm 
                address={data.address} 
                recommendation={data.recommendation}
                recommendedWateringDay={data.forecast.recommendedWateringDay}
                weatherData={data}
                zipCode={zipCode}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PrecipitationDisplay;
