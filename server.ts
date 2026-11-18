import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

interface SevereAlert {
  id: string;
  severity: 'advisory' | 'warning' | 'severe';
  type: 'rain' | 'storm' | 'wind' | 'heat' | 'freeze' | 'uv';
  title: string;
  description: string;
  metricValue: string;
}

function deriveLiveSevereAlerts(forecast: {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    weather_code?: number;
  };
  daily?: {
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_gusts_10m_max?: number[];
    uv_index_max?: number[];
  };
}): SevereAlert[] {
  const alerts: SevereAlert[] = [];
  const cur = forecast.current ?? {};
  const day = forecast.daily ?? {};

  const curTemp = cur.temperature_2m ?? 20;
  const curGusts = cur.wind_gusts_10m ?? cur.wind_speed_10m ?? 0;
  const curCode = cur.weather_code ?? 0;
  const curPrecip = cur.precipitation ?? 0;

  const todayMaxTemp = day.temperature_2m_max?.[0] ?? curTemp;
  const todayMinTemp = day.temperature_2m_min?.[0] ?? curTemp;
  const todayRainSum = day.precipitation_sum?.[0] ?? curPrecip;
  const todayRainProb = day.precipitation_probability_max?.[0] ?? 0;
  const todayMaxGusts = day.wind_gusts_10m_max?.[0] ?? curGusts;
  const todayMaxUv = day.uv_index_max?.[0] ?? 0;
  const todayCode = day.weather_code?.[0] ?? curCode;

  if (curCode >= 95 || todayCode >= 95) {
    alerts.push({
      id: 'storm-alert',
      severity: 'severe',
      type: 'storm',
      title: 'Thunderstorm Activity Alert',
      description: 'Convective thunderstorm cells detected in the atmospheric forecast. Seek indoor shelter during lightning.',
      metricValue: `WMO ${curCode >= 95 ? curCode : todayCode}`,
    });
  }

  if (todayRainSum >= 15 || curPrecip >= 5 || todayRainProb >= 80) {
    alerts.push({
      id: 'heavy-rain-alert',
      severity: todayRainSum >= 30 || curPrecip >= 10 ? 'severe' : 'warning',
      type: 'rain',
      title: 'Heavy Rainfall Advisory',
      description: `High precipitation volume expected (${todayRainSum.toFixed(1)} mm today, ${todayRainProb}% peak probability). Watch for surface runoff.`,
      metricValue: `${todayRainSum.toFixed(1)} mm`,
    });
  }

  if (todayMaxGusts >= 45 || curGusts >= 45) {
    alerts.push({
      id: 'wind-alert',
      severity: todayMaxGusts >= 70 ? 'severe' : 'warning',
      type: 'wind',
      title: 'Strong Wind Gust Warning',
      description: `Peak wind gusts projected up to ${Math.round(todayMaxGusts)} km/h. Secure outdoor items and expect crosswinds.`,
      metricValue: `${Math.round(todayMaxGusts)} km/h`,
    });
  }

  if (todayMaxTemp >= 35 || curTemp >= 35) {
    alerts.push({
      id: 'heat-alert',
      severity: todayMaxTemp >= 40 ? 'severe' : 'warning',
      type: 'heat',
      title: 'Extreme Heat Advisory',
      description: `High thermal stress expected with peak temperatures reaching ${todayMaxTemp.toFixed(1)}°C. Stay hydrated and limit midday exposure.`,
      metricValue: `${todayMaxTemp.toFixed(1)}°C`,
    });
  }

  if (todayMinTemp <= 0 || curTemp <= 0) {
    alerts.push({
      id: 'freeze-alert',
      severity: todayMinTemp <= -8 ? 'severe' : 'advisory',
      type: 'freeze',
      title: 'Frost & Freezing Advisory',
      description: `Sub-zero temperatures down to ${todayMinTemp.toFixed(1)}°C expected. Watch for icy roads and frost.`,
      metricValue: `${todayMinTemp.toFixed(1)}°C`,
    });
  }

  if (todayMaxUv >= 8) {
    alerts.push({
      id: 'uv-alert',
      severity: 'advisory',
      type: 'uv',
      title: 'Very High UV Exposure',
      description: `UV index peaks at ${todayMaxUv.toFixed(1)}. Broad-spectrum sun protection advised between 10:00 and 16:00.`,
      metricValue: `UV ${todayMaxUv.toFixed(1)}`,
    });
  }

  return alerts;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'climora-weather-api' });
});

app.get('/api/weather/search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  const lang = String(req.query.lang ?? 'en').slice(0, 5);

  if (query.length < 2) {
    res.json({ results: [] });
    return;
  }

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query);
    url.searchParams.set('count', '8');
    url.searchParams.set('language', lang);
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`Geocoding upstream HTTP ${response.status}`);
    }
    const data = (await response.json()) as { results?: GeocodingResult[] };
    res.json({
      results: (data.results ?? []).map((item) => ({
        id: String(item.id),
        name: item.name,
        country: item.country ?? 'Global',
        countryCode: item.country_code ?? '',
        admin1: item.admin1 ?? '',
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone ?? 'auto',
      })),
    });
  } catch (err) {
    console.error('Weather search error:', err);
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to reach worldwide location directory.',
    });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const days = Math.min(16, Math.max(1, Number(req.query.days ?? 16) || 16));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
    return;
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    url.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,uv_index,visibility'
    );
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max'
    );
    url.searchParams.set('forecast_days', String(days));
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`Forecast upstream HTTP ${response.status}`);
    }
    const raw = await response.json();
    const alerts = deriveLiveSevereAlerts(raw);
    res.json({
      ...raw,
      alerts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Weather forecast error:', err);
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to fetch live weather forecast.',
    });
  }
});

app.post('/api/weather/predict', async (req, res) => {
  const { locationName, country, language, current, next24hSummary, next7dSummary, isPro } = req.body ?? {};

  if (!locationName || !current) {
    res.status(400).json({ error: 'Location name and current atmospheric metrics are required.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({
      error: 'Smart prediction service key is not configured on the server.',
    });
    return;
  }

  const targetLanguageMap: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    pt: 'Portuguese',
    de: 'German',
    ja: 'Japanese',
  };
  const replyLang = targetLanguageMap[String(language ?? 'en')] ?? 'English';

  try {
    const prompt = `Analyze the following live atmospheric telemetry for ${locationName}${country ? `, ${country}` : ''} and produce a concise, accurate, futuristic smart weather prediction in ${replyLang}.
Current: temp=${current.temperature_2m}°C, feelsLike=${current.apparent_temperature}°C, humidity=${current.relative_humidity_2m}%, precipitation=${current.precipitation}mm, cloudCover=${current.cloud_cover}%, wind=${current.wind_speed_10m}km/h (gusts ${current.wind_gusts_10m}km/h), pressure=${current.surface_pressure}hPa, wmoCode=${current.weather_code}.
Next 24h profile: ${JSON.stringify(next24hSummary ?? {})}.
Next 7d profile: ${JSON.stringify(next7dSummary ?? {})}.
Mode: ${isPro ? 'CLIMORA Pro Deep Atmospheric Analysis' : 'Standard Smart Prediction'}.
Return factual, practical weather predictions based strictly on these measurements.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are CLIMORA Atmospheric Intelligence. Deliver crisp, actionable, accurate weather predictions grounded strictly in the provided meteorological data. Keep each field concise (1-2 sentences).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: 'Short vivid prediction headline (max 10 words).' },
            summary: { type: Type.STRING, description: 'Overall smart atmospheric forecast summary.' },
            rainOutlook: { type: Type.STRING, description: 'Precipitation timing and intensity prediction.' },
            stormRisk: { type: Type.STRING, description: 'Wind, gust, and convective storm risk level.' },
            temperatureTrend: { type: Type.STRING, description: 'Thermal curve and day-night temperature shift.' },
            advisory: { type: Type.STRING, description: 'Practical outdoor, travel, or clothing guidance.' },
            bestWindow: { type: Type.STRING, description: 'Best outdoor time window in the next 24h.' },
          },
          required: ['headline', 'summary', 'rainOutlook', 'stormRisk', 'temperatureTrend', 'advisory', 'bestWindow'],
        },
      },
    });

    const jsonText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(jsonText);
    res.json({ prediction: parsed });
  } catch (err) {
    console.error('Gemini weather prediction error:', err);
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Smart prediction generation failed.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLIMORA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
