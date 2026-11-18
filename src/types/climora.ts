export type PlanTier = 'free' | 'pro_monthly' | 'pro_annual';
export type UnitSystem = 'metric' | 'imperial';
export type LanguageCode = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'ja';
export type ChromaTheme = 'aurora' | 'prism' | 'solar' | 'oceanic';
export type MotionLevel = 'vivid' | 'calm' | 'static';
export type AppSection = 'forecast' | 'locations' | 'alerts' | 'premium' | 'admin';

export interface GeoLocation {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface SevereWeatherAlert {
  id: string;
  severity: 'advisory' | 'warning' | 'severe';
  type: 'rain' | 'storm' | 'wind' | 'heat' | 'freeze' | 'uv';
  title: string;
  description: string;
  metricValue: string;
}

export interface WeatherForecastPayload {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
    weather_code: number;
    cloud_cover: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    uv_index: number[];
    visibility: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
  };
  alerts: SevereWeatherAlert[];
  fetchedAt: string;
}

export interface SmartPrediction {
  headline: string;
  summary: string;
  rainOutlook: string;
  stormRisk: string;
  temperatureTrend: string;
  advisory: string;
  bestWindow: string;
}

export interface UserAccount {
  uid: string;
  displayName: string;
  plan: PlanTier;
  preferredUnit: UnitSystem;
  preferredLang: LanguageCode;
  chromaTheme: ChromaTheme;
  lastActiveAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  updatedAt: unknown;
}

export interface SavedLocationDoc {
  id: string;
  uid: string;
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isPrimary: boolean;
  createdAt: unknown;
}

export type AlertMetric = 'rain_prob' | 'wind_speed' | 'temp_high' | 'temp_low' | 'storm';

export interface WeatherAlertRule {
  id: string;
  uid: string;
  locationName: string;
  latitude: number;
  longitude: number;
  metric: AlertMetric;
  threshold: number;
  enabled: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: 'pro_monthly' | 'pro_annual' | 'storm_radar_pack' | 'ad_free_pass';
  amountUsd: number;
  billingCycle: 'monthly' | 'annual' | 'one_time';
  status: 'active' | 'cancelled';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AdCampaign {
  id: string;
  sponsorName: string;
  headline: string;
  description: string;
  ctaLabel: string;
  targetUrl: string;
  cpmUsd: number;
  cpcUsd: number;
  impressions: number;
  clicks: number;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RevenueEvent {
  id: string;
  source: 'subscription' | 'ad_impression' | 'ad_click' | 'sponsorship' | 'paid_addon';
  label: string;
  amountUsd: number;
  userId: string;
  createdAt: unknown;
}

export interface AppSettings {
  adsEnabled: boolean;
  proMonthlyPrice: number;
  proAnnualPrice: number;
  defaultForecastDays: number;
  announcement: string;
  maintenanceMode: boolean;
  updatedAt: unknown;
}
