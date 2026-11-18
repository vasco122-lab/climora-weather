import type {
  GeoLocation,
  LanguageCode,
  SmartPrediction,
  UnitSystem,
  WeatherForecastPayload,
} from '../types/climora';

export const DEFAULT_WORLD_CITIES: GeoLocation[] = [
  {
    id: '2643743',
    name: 'London',
    country: 'United Kingdom',
    admin1: 'England',
    latitude: 51.5085,
    longitude: -0.1257,
    timezone: 'Europe/London',
  },
  {
    id: '5128581',
    name: 'New York',
    country: 'United States',
    admin1: 'New York',
    latitude: 40.7143,
    longitude: -74.006,
    timezone: 'America/New_York',
  },
  {
    id: '1850147',
    name: 'Tokyo',
    country: 'Japan',
    admin1: 'Tokyo',
    latitude: 35.6895,
    longitude: 139.6917,
    timezone: 'Asia/Tokyo',
  },
  {
    id: '3451190',
    name: 'Rio de Janeiro',
    country: 'Brazil',
    admin1: 'Rio de Janeiro',
    latitude: -22.9064,
    longitude: -43.1822,
    timezone: 'America/Sao_Paulo',
  },
  {
    id: '2332459',
    name: 'Lagos',
    country: 'Nigeria',
    admin1: 'Lagos',
    latitude: 6.4541,
    longitude: 3.3947,
    timezone: 'Africa/Lagos',
  },
  {
    id: '2147714',
    name: 'Sydney',
    country: 'Australia',
    admin1: 'New South Wales',
    latitude: -33.8678,
    longitude: 151.2073,
    timezone: 'Australia/Sydney',
  },
];

export type WeatherVisualType =
  | 'sun'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export function mapWmoCode(code: number): { label: string; visual: WeatherVisualType } {
  if (code === 0) return { label: 'Clear Sky', visual: 'sun' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', visual: 'partly-cloudy' };
  if (code === 3) return { label: 'Overcast', visual: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Fog & Mist', visual: 'fog' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: code >= 63 || code >= 81 ? 'Heavy Rain' : 'Rain Showers', visual: 'rain' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: 'Snowfall', visual: 'snow' };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Thunderstorm', visual: 'storm' };
  }
  return { label: 'Variable Sky', visual: 'partly-cloudy' };
}

export function formatTemp(celsius: number, unit: UnitSystem, withUnit = true): string {
  const val = unit === 'imperial' ? (celsius * 9) / 5 + 32 : celsius;
  const rounded = Math.round(val);
  return withUnit ? `${rounded}°${unit === 'imperial' ? 'F' : 'C'}` : `${rounded}°`;
}

export function formatWind(kmh: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return `${Math.round(kmh * 0.621371)} mph`;
  }
  return `${Math.round(kmh)} km/h`;
}

export function formatPrecip(mm: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return `${(mm * 0.0393701).toFixed(2)} in`;
  }
  return `${mm.toFixed(1)} mm`;
}

export function compassDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export async function searchWorldwideLocations(
  query: string,
  lang: LanguageCode = 'en'
): Promise<GeoLocation[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(
    `/api/weather/search?q=${encodeURIComponent(query.trim())}&lang=${encodeURIComponent(lang)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to search locations.');
  }
  const data = await res.json();
  return data.results ?? [];
}

export async function fetchLiveForecast(
  lat: number,
  lon: number,
  days = 16
): Promise<WeatherForecastPayload> {
  const res = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&days=${days}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load live forecast.');
  }
  return res.json();
}

export async function fetchSmartPrediction(params: {
  locationName: string;
  country: string;
  language: LanguageCode;
  forecast: WeatherForecastPayload;
  isPro: boolean;
}): Promise<SmartPrediction> {
  const { forecast } = params;
  const next24hSummary = {
    maxTemp: Math.max(...forecast.hourly.temperature_2m.slice(0, 24)),
    minTemp: Math.min(...forecast.hourly.temperature_2m.slice(0, 24)),
    maxRainProb: Math.max(...forecast.hourly.precipitation_probability.slice(0, 24)),
    totalPrecipMm: forecast.hourly.precipitation.slice(0, 24).reduce((a, b) => a + b, 0),
    maxWindKmh: Math.max(...forecast.hourly.wind_speed_10m.slice(0, 24)),
  };
  const next7dSummary = {
    days: forecast.daily.time.slice(0, 7).map((date, idx) => ({
      date,
      code: forecast.daily.weather_code[idx],
      max: forecast.daily.temperature_2m_max[idx],
      min: forecast.daily.temperature_2m_min[idx],
      rainMm: forecast.daily.precipitation_sum[idx],
      rainProb: forecast.daily.precipitation_probability_max[idx],
    })),
  };

  const res = await fetch('/api/weather/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationName: params.locationName,
      country: params.country,
      language: params.language,
      current: forecast.current,
      next24hSummary,
      next7dSummary,
      isPro: params.isPro,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Smart prediction service unavailable.');
  }
  const data = await res.json();
  return data.prediction;
}
