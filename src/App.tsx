import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertTriangle,
  Bell,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Globe,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Wind,
} from 'lucide-react';
import { AdBanner } from './components/AdBanner';
import { AdminDashboard } from './components/AdminDashboard';
import { AnimatedWeatherIcon } from './components/AnimatedWeatherIcon';
import { AuthModal } from './components/AuthModal';
import { DailyThermalRangeBars, HourlySpectrumChart } from './components/ChromaCharts';
import { PremiumView } from './components/PremiumView';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL } from './firebase';
import { LANGUAGE_LABELS, TRANSLATIONS } from './i18n/translations';
import {
  createAlertRule,
  DEFAULT_APP_SETTINGS,
  deleteAlertRule,
  ensureUserDocuments,
  removeSavedLocation,
  saveLocationForUser,
  subscribeActiveAdCampaigns,
  subscribeAlertRules,
  subscribeAppSettings,
  subscribeSavedLocations,
  subscribeUserAccount,
  subscribeUserSubscriptions,
  toggleAlertRule,
  updateUserPreferences,
} from './services/firestoreService';
import {
  compassDirection,
  DEFAULT_WORLD_CITIES,
  fetchLiveForecast,
  fetchSmartPrediction,
  formatPrecip,
  formatTemp,
  formatWind,
  mapWmoCode,
  searchWorldwideLocations,
} from './services/weatherService';
import type {
  AdCampaign,
  AlertMetric,
  AppSection,
  AppSettings,
  ChromaTheme,
  GeoLocation,
  LanguageCode,
  MotionLevel,
  SavedLocationDoc,
  SmartPrediction,
  SubscriptionRecord,
  UnitSystem,
  UserAccount,
  UserPrivateInfo,
  WeatherAlertRule,
  WeatherForecastPayload,
} from './types/climora';

export default function App() {
  const [section, setSection] = useState<AppSection>('forecast');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Firebase Auth & Firestore User State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocationDoc[]>([]);
  const [alertRules, setAlertRules] = useState<WeatherAlertRule[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [adCampaigns, setAdCampaigns] = useState<AdCampaign[]>([]);

  // Appearance & Worldwide Access Preferences
  const [unit, setUnit] = useState<UnitSystem>('metric');
  const [lang, setLang] = useState<LanguageCode>('en');
  const [chromaTheme, setChromaTheme] = useState<ChromaTheme>('aurora');
  const [motionLevel, setMotionLevel] = useState<MotionLevel>('vivid');

  // Weather & Location State
  const [activeLocation, setActiveLocation] = useState<GeoLocation>(DEFAULT_WORLD_CITIES[0]);
  const [forecast, setForecast] = useState<WeatherForecastPayload | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Smart Prediction State
  const [prediction, setPrediction] = useState<SmartPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Hero backdrop fallback
  const [heroImgError, setHeroImgError] = useState(false);

  // Custom Alert Builder State
  const [newAlertMetric, setNewAlertMetric] = useState<AlertMetric>('rain_prob');
  const [newAlertThreshold, setNewAlertThreshold] = useState('65');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const t = TRANSLATIONS[lang];

  const isAdmin = Boolean(
    firebaseUser &&
      firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL &&
      firebaseUser.emailVerified
  );

  const isPro = Boolean(
    account?.plan === 'pro_monthly' ||
      account?.plan === 'pro_annual' ||
      subscriptions.some((s) => s.status === 'active' && s.planId === 'ad_free_pass')
  );

  const hasExtendedPro = Boolean(
    account?.plan === 'pro_monthly' || account?.plan === 'pro_annual'
  );

  // Sync CSS data attributes for rainbow themes and motion speed
  useEffect(() => {
    document.documentElement.setAttribute('data-chroma', chromaTheme);
    document.documentElement.setAttribute('data-motion', motionLevel);
  }, [chromaTheme, motionLevel]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        ensureUserDocuments({
          uid: user.uid,
          fullName: user.displayName || user.email?.split('@')[0] || 'Explorer',
          email: user.email || '',
          phone: user.phoneNumber || '',
        }).catch(() => {});
      } else {
        setAccount(null);
        setPrivateInfo(null);
        setSavedLocations([]);
        setAlertRules([]);
        setSubscriptions([]);
      }
    });
    return unsub;
  }, []);

  // Global app config & active ad campaigns
  useEffect(() => {
    const unsubSettings = subscribeAppSettings(setAppSettings);
    const unsubAds = subscribeActiveAdCampaigns(setAdCampaigns);
    return () => {
      unsubSettings();
      unsubAds();
    };
  }, []);

  // User-scoped Firestore listeners
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const unsubUser = subscribeUserAccount(firebaseUser.uid, (acc, priv) => {
      setAccount(acc);
      setPrivateInfo(priv);
      if (acc) {
        setUnit(acc.preferredUnit);
        setLang(acc.preferredLang);
        setChromaTheme(acc.chromaTheme);
      }
    });
    const unsubLocs = subscribeSavedLocations(firebaseUser.uid, setSavedLocations);
    const unsubAlerts = subscribeAlertRules(firebaseUser.uid, setAlertRules);
    const unsubSubs = subscribeUserSubscriptions(firebaseUser.uid, setSubscriptions);

    return () => {
      unsubUser();
      unsubLocs();
      unsubAlerts();
      unsubSubs();
    };
  }, [authReady, firebaseUser]);

  // Load live forecast whenever activeLocation changes
  const loadWeather = useCallback(async (loc: GeoLocation) => {
    setForecastLoading(true);
    setForecastError(null);
    setPrediction(null);
    setPredictionError(null);
    try {
      const data = await fetchLiveForecast(loc.latitude, loc.longitude, 16);
      setForecast(data);
    } catch (err) {
      setForecastError(err instanceof Error ? err.message : 'Unable to load weather data.');
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(activeLocation);
  }, [activeLocation, loadWeather]);

  // Generate Smart Prediction via Gemini backend
  const handleRunSmartPrediction = useCallback(async () => {
    if (!forecast) return;
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const res = await fetchSmartPrediction({
        locationName: activeLocation.name,
        country: activeLocation.country,
        language: lang,
        forecast,
        isPro: hasExtendedPro,
      });
      setPrediction(res);
    } catch (err) {
      setPredictionError(
        err instanceof Error ? err.message : 'Unable to generate smart prediction.'
      );
    } finally {
      setPredictionLoading(false);
    }
  }, [activeLocation.country, activeLocation.name, forecast, hasExtendedPro, lang]);

  // Debounced worldwide search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchWorldwideLocations(searchQuery, lang);
        setSearchResults(res);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, lang]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setForecastError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setActiveLocation({
          id: `geo_${Math.round(pos.coords.latitude * 100)}_${Math.round(pos.coords.longitude * 100)}`,
          name: 'Current Coordinates',
          country: 'Local GPS',
          admin1: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: 'auto',
        });
        setSection('forecast');
      },
      () => {
        setForecastError('Location permission denied. Search any city or town manually.');
      }
    );
  };

  const handleUnitChange = (nextUnit: UnitSystem) => {
    setUnit(nextUnit);
    if (firebaseUser) {
      updateUserPreferences(firebaseUser.uid, { preferredUnit: nextUnit }).catch(() => {});
    }
  };

  const handleLangChange = (nextLang: LanguageCode) => {
    setLang(nextLang);
    if (firebaseUser) {
      updateUserPreferences(firebaseUser.uid, { preferredLang: nextLang }).catch(() => {});
    }
  };

  const handleThemeChange = (nextTheme: ChromaTheme) => {
    setChromaTheme(nextTheme);
    if (firebaseUser) {
      updateUserPreferences(firebaseUser.uid, { chromaTheme: nextTheme }).catch(() => {});
    }
  };

  const handleSaveCurrentLocation = async () => {
    if (!firebaseUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!hasExtendedPro && savedLocations.length >= 3) {
      setLocationNotice('Free plan supports up to 3 saved cities. Upgrade to CLIMORA Pro for unlimited locations.');
      return;
    }
    setLocationNotice(null);
    await saveLocationForUser(firebaseUser.uid, activeLocation);
    setLocationNotice(`${activeLocation.name} saved to your worldwide list.`);
  };

  const handleAddAlertRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!hasExtendedPro && alertRules.length >= 2) {
      setAlertNotice('Free plan allows 2 custom alert rules. Upgrade to Pro for unlimited alerts.');
      return;
    }
    setAlertNotice(null);
    await createAlertRule({
      uid: firebaseUser.uid,
      locationName: activeLocation.name,
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      metric: newAlertMetric,
      threshold: Number(newAlertThreshold) || 0,
    });
    setAlertNotice(`Custom alert rule added for ${activeLocation.name}.`);
  };

  // Evaluate user's custom rules against live forecast
  const triggeredCustomAlerts = useMemo(() => {
    if (!forecast) return [];
    const cur = forecast.current;
    const todayRainProb = forecast.daily.precipitation_probability_max?.[0] ?? 0;
    return alertRules.filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.metric === 'rain_prob') return todayRainProb >= rule.threshold;
      if (rule.metric === 'wind_speed') return cur.wind_gusts_10m >= rule.threshold;
      if (rule.metric === 'temp_high') return cur.temperature_2m >= rule.threshold;
      if (rule.metric === 'temp_low') return cur.temperature_2m <= rule.threshold;
      if (rule.metric === 'storm') return cur.weather_code >= 95;
      return false;
    });
  }, [alertRules, forecast]);

  const currentWmo = forecast ? mapWmoCode(forecast.current.weather_code) : null;
  const forecastDayLimit = hasExtendedPro
    ? 16
    : Math.min(16, Math.max(3, appSettings.defaultForecastDays || 7));

  const visibleDays = forecast ? forecast.daily.time.slice(0, forecastDayLimit) : [];
  const totalAlertCount = (forecast?.alerts.length ?? 0) + triggeredCustomAlerts.length;

  return (
    <div className="min-h-screen relative text-slate-100 flex flex-col">
      {/* Continuously Colour-Changing Rainbow Aurora Backdrop */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050814]">
        <div className="aurora-backdrop absolute -inset-24 opacity-95" />
      </div>

      {/* Optional Admin Global Announcement */}
      {appSettings.announcement && (
        <div className="bg-slate-950/80 border-b border-white/10 px-4 py-2 text-center text-xs text-slate-200">
          {appSettings.maintenanceMode && (
            <span className="font-semibold text-amber-300 mr-2">Notice:</span>
          )}
          <span>{appSettings.announcement}</span>
        </div>
      )}

      {/* TOP BAR CONTRACT: 3 Zones, single-row, gap-8 */}
      <header className="sticky top-0 z-40 bg-[#050814]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setSection('forecast')}
            className="text-xl font-extrabold tracking-tight chroma-text whitespace-nowrap shrink-0 cursor-pointer"
          >
            CLIMORA
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => setSection('forecast')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                section === 'forecast'
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'hover:text-white'
              }`}
            >
              {t.navForecast}
            </button>
            <button
              type="button"
              onClick={() => setSection('locations')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                section === 'locations'
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'hover:text-white'
              }`}
            >
              {t.navLocations}
            </button>
            <button
              type="button"
              onClick={() => setSection('alerts')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                section === 'alerts'
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'hover:text-white'
              }`}
            >
              {t.navAlerts}
              {totalAlertCount > 0 ? ` (${totalAlertCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setSection('premium')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                section === 'premium'
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'hover:text-white'
              }`}
            >
              {t.navPremium}
            </button>
            <button
              type="button"
              onClick={() => setSection('admin')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                section === 'admin'
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'hover:text-white'
              }`}
            >
              {t.navAdmin}
            </button>
          </nav>

          {/* Zone 3: 1 primary CTA button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="chroma-btn px-4 py-2 rounded-xl text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              {firebaseUser
                ? account?.displayName || firebaseUser.displayName || t.account
                : t.signIn}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom-Compact Nav Row (keeps header clean & within mobile sticky cap) */}
      <div className="md:hidden border-b border-white/10 bg-[#050814]/85 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        {(['forecast', 'locations', 'alerts', 'premium', 'admin'] as AppSection[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSection(tab)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 font-medium ${
              section === tab ? 'bg-white/15 text-white' : 'text-slate-400'
            }`}
          >
            {tab === 'forecast'
              ? t.navForecast
              : tab === 'locations'
                ? t.navLocations
                : tab === 'alerts'
                  ? t.navAlerts
                  : tab === 'premium'
                    ? t.navPremium
                    : t.navAdmin}
          </button>
        ))}
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-8">
        {/* Workspace Control Bar: Global Search + GPS + Units + Language + Colour Controls */}
        <section
          aria-label="Workspace Controls"
          className="chroma-surface rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-30"
        >
          {/* Worldwide Search */}
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-xl bg-slate-950/75 border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LocateFixed className="w-4 h-4 text-cyan-300" />
                <span className="hidden sm:inline">{t.useMyLocation}</span>
              </button>
            </div>

            {showDropdown && (searchResults.length > 0 || searchLoading) && (
              <div className="absolute left-0 right-0 mt-2 rounded-xl bg-[#0b1124] border border-white/15 shadow-2xl overflow-hidden z-50">
                {searchLoading ? (
                  <div className="px-4 py-3 text-xs text-slate-400">Searching worldwide...</div>
                ) : (
                  searchResults.map((loc) => (
                    <button
                      key={`${loc.id}_${loc.latitude}`}
                      type="button"
                      onClick={() => {
                        setActiveLocation(loc);
                        setSearchQuery('');
                        setShowDropdown(false);
                        setSection('forecast');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center justify-between gap-3 text-sm border-b border-white/5 last:border-0"
                    >
                      <span className="font-medium text-white truncate">
                        {loc.name}
                        {loc.admin1 ? `, ${loc.admin1}` : ''}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{loc.country}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Spectrum, Motion, Units & Language Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Unit segmented toggle */}
            <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => handleUnitChange('metric')}
                className={`px-2.5 py-1.5 rounded-lg font-mono font-semibold whitespace-nowrap ${
                  unit === 'metric' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                °C
              </button>
              <button
                type="button"
                onClick={() => handleUnitChange('imperial')}
                className={`px-2.5 py-1.5 rounded-lg font-mono font-semibold whitespace-nowrap ${
                  unit === 'imperial' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                °F
              </button>
            </div>

            {/* Spectrum selector */}
            <select
              aria-label={t.chromaLabel}
              value={chromaTheme}
              onChange={(e) => handleThemeChange(e.target.value as ChromaTheme)}
              className="rounded-xl bg-slate-950/80 border border-white/15 px-3 py-2 text-xs font-medium text-slate-100"
            >
              <option value="aurora">Aurora</option>
              <option value="prism">Prism</option>
              <option value="solar">Solar</option>
              <option value="oceanic">Oceanic</option>
            </select>

            {/* Motion speed */}
            <select
              aria-label={t.motionLabel}
              value={motionLevel}
              onChange={(e) => setMotionLevel(e.target.value as MotionLevel)}
              className="rounded-xl bg-slate-950/80 border border-white/15 px-3 py-2 text-xs font-medium text-slate-100"
            >
              <option value="vivid">Vivid Flow</option>
              <option value="calm">Calm Flow</option>
              <option value="static">Static</option>
            </select>

            {/* Worldwide Language */}
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950/80 border border-white/15 px-2.5 py-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => handleLangChange(e.target.value as LanguageCode)}
                className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none"
              >
                {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                  <option key={code} value={code} className="bg-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 1: LIVE FORECAST DASHBOARD */}
        {section === 'forecast' && (
          <div className="space-y-8">
            {/* Active Severe Weather Banner (when real alerts trigger) */}
            {forecast && (forecast.alerts.length > 0 || triggeredCustomAlerts.length > 0) && (
              <div className="chroma-surface rounded-2xl p-4 border border-amber-400/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-white">
                      {forecast.alerts[0]?.title || 'Custom Alert Triggered'}
                    </span>
                    <span className="mx-2 text-slate-500">·</span>
                    <span className="text-slate-300">
                      {forecast.alerts[0]?.description ||
                        `${triggeredCustomAlerts.length} custom threshold rule(s) active in ${activeLocation.name}.`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSection('alerts')}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4 whitespace-nowrap"
                >
                  View Alerts ({totalAlertCount})
                </button>
              </div>
            )}

            {/* Hero Split: Live Atmospheric Showcase + Smart Weather Prediction */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Main Weather Card */}
              <div className="lg:col-span-7 chroma-surface chroma-surface-bright rounded-2xl overflow-hidden relative flex flex-col justify-between min-h-[340px]">
                {!heroImgError ? (
                  <img
                    src="/src/assets/images/climora_aurora_sky_1794992401439.jpg"
                    alt={`${activeLocation.name} atmospheric sky`}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/40 via-purple-900/35 to-amber-900/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/75 to-[#050814]/40" />

                <div className="relative z-10 p-6 md:p-8 flex flex-col justify-between h-full gap-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-300 flex items-center gap-2">
                        <span>{t.slogan}</span>
                        <span aria-hidden="true">·</span>
                        <span>{forecast?.timezone || activeLocation.timezone}</span>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                        {activeLocation.name}
                      </h1>
                      <p className="text-sm text-slate-300">
                        {activeLocation.admin1 ? `${activeLocation.admin1}, ` : ''}
                        {activeLocation.country}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCurrentLocation}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                      <span>{t.saveCurrentCity}</span>
                    </button>
                  </div>

                  {locationNotice && (
                    <div className="text-xs text-cyan-200 bg-cyan-500/10 border border-cyan-400/30 rounded-xl px-3.5 py-2">
                      {locationNotice}
                    </div>
                  )}

                  {forecastLoading ? (
                    <div className="py-8 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
                      <div className="space-y-2">
                        <div className="w-32 h-10 rounded-xl bg-white/10 animate-pulse" />
                        <div className="w-44 h-4 rounded bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  ) : forecastError ? (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                      {forecastError}
                    </div>
                  ) : forecast && currentWmo ? (
                    <div className="flex flex-wrap items-end justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <AnimatedWeatherIcon visual={currentWmo.visual} size={84} />
                        <div>
                          <div className="text-6xl md:text-7xl font-extrabold font-display tabular-nums chroma-text leading-none">
                            {formatTemp(forecast.current.temperature_2m, unit)}
                          </div>
                          <div className="text-base font-semibold text-white mt-2">
                            {currentWmo.label}
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1 text-sm font-mono tabular-nums">
                        <div className="text-slate-300">
                          {t.feelsLike}:{' '}
                          <span className="text-white font-semibold">
                            {formatTemp(forecast.current.apparent_temperature, unit)}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          H: <span className="text-amber-300">{formatTemp(forecast.daily.temperature_2m_max[0], unit, false)}</span>
                          <span className="mx-2 text-slate-500">/</span>
                          L: <span className="text-cyan-300">{formatTemp(forecast.daily.temperature_2m_min[0], unit, false)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Smart Weather Prediction Panel (Gemini AI) */}
              <div className="lg:col-span-5 chroma-surface rounded-2xl p-6 md:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-300" />
                      <h2 className="text-lg font-bold chroma-text">{t.smartPredictionTitle}</h2>
                    </div>
                    <button
                      type="button"
                      disabled={predictionLoading || !forecast}
                      onClick={handleRunSmartPrediction}
                      className="chroma-btn px-3.5 py-2 rounded-xl text-xs whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {predictionLoading ? t.refreshing : t.generatePrediction}
                    </button>
                  </div>

                  {predictionError && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                      {predictionError}
                    </div>
                  )}

                  {prediction ? (
                    <div className="space-y-3 text-sm">
                      <h3 className="text-base font-bold text-white leading-snug">
                        {prediction.headline}
                      </h3>
                      <p className="text-slate-300 leading-relaxed">{prediction.summary}</p>
                      <div className="chroma-divider" />
                      <div className="grid grid-cols-1 gap-2.5 text-xs">
                        <div>
                          <span className="text-cyan-300 font-semibold">Rain Outlook: </span>
                          <span className="text-slate-200">{prediction.rainOutlook}</span>
                        </div>
                        <div>
                          <span className="text-fuchsia-300 font-semibold">Storm &amp; Wind Risk: </span>
                          <span className="text-slate-200">{prediction.stormRisk}</span>
                        </div>
                        <div>
                          <span className="text-amber-300 font-semibold">Temperature Trend: </span>
                          <span className="text-slate-200">{prediction.temperatureTrend}</span>
                        </div>
                        <div>
                          <span className="text-emerald-300 font-semibold">Best Window: </span>
                          <span className="text-slate-200">{prediction.bestWindow}</span>
                        </div>
                        <div>
                          <span className="text-slate-200 font-semibold">Advisory: </span>
                          <span className="text-slate-300">{prediction.advisory}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                      <p>
                        Generate an atmospheric prediction for <strong className="text-white">{activeLocation.name}</strong> combining live rainfall, barometric pressure, wind gusts, and 7-day thermal trends.
                      </p>
                      {forecast && (
                        <div className="pt-2 space-y-2 text-xs text-slate-300 border-t border-white/10">
                          <div>
                            <span className="text-cyan-300 font-semibold">Next 24h Peak Rain Prob: </span>
                            <span className="font-mono tabular-nums text-white">
                              {Math.max(...forecast.hourly.precipitation_probability.slice(0, 24))}%
                            </span>
                          </div>
                          <div>
                            <span className="text-amber-300 font-semibold">Peak Wind Gusts Today: </span>
                            <span className="font-mono tabular-nums text-white">
                              {formatWind(forecast.daily.wind_gusts_10m_max[0] ?? 0, unit)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  {hasExtendedPro
                    ? 'CLIMORA Pro Deep Atmospheric Mode active'
                    : 'Standard Atmospheric Mode · Upgrade for Pro Deep Analysis'}
                </div>
              </div>
            </div>

            {/* Live Weather Telemetry Strip */}
            {forecast && (
              <section
                aria-label="Live Weather Telemetry"
                className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
              >
                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{t.rainfall}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {formatPrecip(forecast.current.precipitation, unit)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    {forecast.daily.precipitation_probability_max[0] ?? 0}% prob
                  </div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Wind className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{t.windSpeed}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {formatWind(forecast.current.wind_speed_10m, unit)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums flex items-center gap-1">
                    <Compass className="w-3 h-3" />
                    <span>{compassDirection(forecast.current.wind_direction_10m)} · G {formatWind(forecast.current.wind_gusts_10m, unit)}</span>
                  </div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Droplets className="w-3.5 h-3.5 text-blue-300" />
                    <span>{t.humidity}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {forecast.current.relative_humidity_2m}%
                  </div>
                  <div className="text-xs text-slate-400">Relative</div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Sun className="w-3.5 h-3.5 text-fuchsia-300" />
                    <span>{t.cloudCover}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {forecast.current.cloud_cover}%
                  </div>
                  <div className="text-xs text-slate-400">Sky density</div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                    <span>{t.uvIndex}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {(forecast.daily.uv_index_max[0] ?? 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-400">Daily Peak</div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Gauge className="w-3.5 h-3.5 text-pink-300" />
                    <span>{t.pressure}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {Math.round(forecast.current.surface_pressure)}
                  </div>
                  <div className="text-xs text-slate-400">hPa</div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Eye className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{t.visibility}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    {((forecast.hourly.visibility?.[0] ?? 10000) / 1000).toFixed(1)} km
                  </div>
                  <div className="text-xs text-slate-400">Optical range</div>
                </div>

                <div className="chroma-surface rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Sunrise className="w-3.5 h-3.5 text-amber-300" />
                    <span>Sun Cycle</span>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-white pt-1">
                    {forecast.daily.sunrise[0]?.slice(11, 16)}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400 flex items-center gap-1">
                    <Sunset className="w-3 h-3 text-rose-300" />
                    <span>{forecast.daily.sunset[0]?.slice(11, 16)}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Hourly & Daily Forecasts */}
            {forecast && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Hourly Chart + Cards */}
                <div className="lg:col-span-7 chroma-surface rounded-2xl p-6 space-y-6">
                  <h2 className="text-xl font-bold chroma-text">{t.hourlyForecast}</h2>
                  <HourlySpectrumChart
                    times={forecast.hourly.time}
                    temps={forecast.hourly.temperature_2m}
                    rainProbs={forecast.hourly.precipitation_probability}
                    unit={unit}
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-2">
                    {forecast.hourly.time.slice(0, 6).map((timeStr, idx) => {
                      const wmo = mapWmoCode(forecast.hourly.weather_code[idx]);
                      return (
                        <div
                          key={timeStr}
                          className="rounded-xl bg-white/5 border border-white/10 p-3 text-center space-y-1.5"
                        >
                          <div className="text-xs font-mono tabular-nums text-slate-400">
                            {timeStr.slice(11, 16)}
                          </div>
                          <div className="flex justify-center">
                            <AnimatedWeatherIcon visual={wmo.visual} size={32} />
                          </div>
                          <div className="text-sm font-bold font-mono tabular-nums text-white">
                            {formatTemp(forecast.hourly.temperature_2m[idx], unit, false)}
                          </div>
                          <div className="text-xs font-mono tabular-nums text-cyan-300">
                            {forecast.hourly.precipitation_probability[idx]}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily & Weekly (7-day / 16-day Pro) */}
                <div className="lg:col-span-5 chroma-surface rounded-2xl p-6 space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-bold chroma-text">
                        {hasExtendedPro ? t.extended16Day : t.dailyForecast}
                      </h2>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {visibleDays.length} days
                      </span>
                    </div>
                    <DailyThermalRangeBars
                      dates={visibleDays}
                      mins={forecast.daily.temperature_2m_min.slice(0, visibleDays.length)}
                      maxs={forecast.daily.temperature_2m_max.slice(0, visibleDays.length)}
                      unit={unit}
                    />
                  </div>

                  {!hasExtendedPro && (
                    <button
                      type="button"
                      onClick={() => setSection('premium')}
                      className="chroma-btn w-full py-2.5 px-4 rounded-xl text-xs whitespace-nowrap cursor-pointer"
                    >
                      {t.unlock16Day}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sponsored Ad Placement for non-Pro users */}
            {appSettings.adsEnabled && !isPro && (
              <AdBanner
                campaigns={adCampaigns}
                isSignedIn={Boolean(firebaseUser)}
                sponsoredLabel={t.sponsored}
                removeAdsLabel={t.removeAds}
                onUpgradeClick={() => setSection('premium')}
              />
            )}
          </div>
        )}

        {/* SECTION 2: WORLDWIDE LOCATIONS */}
        {section === 'locations' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold chroma-text">{t.savedLocationsTitle}</h2>
                <p className="text-sm text-slate-300 mt-1">
                  Check live weather in towns, cities, and countries across the globe.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCurrentLocation}
                className="chroma-btn px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save {activeLocation.name}</span>
              </button>
            </div>

            {locationNotice && (
              <div className="chroma-surface rounded-xl px-4 py-3 text-xs text-cyan-200 border border-cyan-400/30">
                {locationNotice}
              </div>
            )}

            {/* User Saved Locations */}
            <div className="chroma-surface rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Your Saved Cities</h3>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {savedLocations.length} / {hasExtendedPro ? 'Unlimited' : '3'}
                </span>
              </div>

              {!firebaseUser ? (
                <div className="py-6 text-sm text-slate-300 flex flex-wrap items-center justify-between gap-4">
                  <span>Sign in to save your favorite cities and sync them across devices.</span>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="chroma-btn px-4 py-2 rounded-xl text-xs whitespace-nowrap"
                  >
                    {t.signIn}
                  </button>
                </div>
              ) : savedLocations.length === 0 ? (
                <div className="py-6 text-sm text-slate-400">
                  No saved cities yet. Search any town or city above and click “Save Location”.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLocation(loc);
                          setSection('forecast');
                        }}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="font-semibold text-white truncate">{loc.name}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {loc.admin1 ? `${loc.admin1}, ` : ''}
                          {loc.country}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${loc.name}`}
                        onClick={() => removeSavedLocation(firebaseUser.uid, loc.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Global Featured Hubs */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Global Weather Hubs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {DEFAULT_WORLD_CITIES.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      setActiveLocation(city);
                      setSection('forecast');
                    }}
                    className="chroma-surface rounded-2xl p-5 text-left hover:bg-white/5 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="text-lg font-bold text-white">{city.name}</div>
                      <div className="text-xs text-slate-400">
                        {city.admin1}, {city.country}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-cyan-300 shrink-0">View Live →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: WEATHER ALERTS CENTER */}
        {section === 'alerts' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold chroma-text">{t.alertsTitle}</h2>
              <p className="text-sm text-slate-300 mt-1">
                Real-time severe atmospheric warnings for {activeLocation.name} plus custom user alert thresholds.
              </p>
            </div>

            {/* Live Severe Alerts */}
            <div className="chroma-surface rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="text-lg font-bold text-white">{t.liveSevereAlerts}</h3>
              </div>

              {!forecast || forecast.alerts.length === 0 ? (
                <p className="text-sm text-slate-300">{t.noActiveSevere}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {forecast.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-sm">{alert.title}</span>
                        <span className="text-xs font-mono tabular-nums text-amber-300">
                          {alert.severity.toUpperCase()} · {alert.metricValue}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{alert.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Alert Rules */}
            <div className="chroma-surface rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-300" />
                  <h3 className="text-lg font-bold text-white">{t.customAlertRules}</h3>
                </div>
                <span className="text-xs text-slate-400">
                  Location: <strong className="text-white">{activeLocation.name}</strong>
                </span>
              </div>

              {alertNotice && (
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
                  {alertNotice}
                </div>
              )}

              <form onSubmit={handleAddAlertRule} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3">
                <select
                  value={newAlertMetric}
                  onChange={(e) => setNewAlertMetric(e.target.value as AlertMetric)}
                  className="rounded-xl bg-slate-900/90 border border-white/15 px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="rain_prob">Rain Probability ≥ (%)</option>
                  <option value="wind_speed">Wind Gusts ≥ (km/h)</option>
                  <option value="temp_high">Extreme Heat ≥ (°C)</option>
                  <option value="temp_low">Freezing Temp ≤ (°C)</option>
                  <option value="storm">Thunderstorm Detection</option>
                </select>
                <input
                  type="number"
                  value={newAlertThreshold}
                  onChange={(e) => setNewAlertThreshold(e.target.value)}
                  className="rounded-xl bg-slate-900/90 border border-white/15 px-3.5 py-2.5 text-sm text-white font-mono tabular-nums"
                />
                <button
                  type="submit"
                  className="chroma-btn px-4 py-2.5 rounded-xl text-xs whitespace-nowrap cursor-pointer"
                >
                  {t.createAlertRule}
                </button>
              </form>

              {!firebaseUser ? (
                <p className="text-xs text-slate-400">
                  Sign in to persist custom weather alert notifications to your account.
                </p>
              ) : alertRules.length === 0 ? (
                <p className="text-xs text-slate-400">No custom alert rules configured yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {alertRules.map((rule) => {
                    const isTriggered = triggeredCustomAlerts.some((tr) => tr.id === rule.id);
                    return (
                      <div
                        key={rule.id}
                        className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">
                            {rule.locationName} · {rule.metric.replace('_', ' ')} ({rule.threshold})
                          </div>
                          <div className="text-xs text-slate-400">
                            {isTriggered ? 'TRIGGERED right now for active location' : 'Monitoring live conditions'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              toggleAlertRule(firebaseUser.uid, rule.id, !rule.enabled)
                            }
                            className="px-3 py-1 rounded-lg bg-white/10 text-xs text-white"
                          >
                            {rule.enabled ? 'Enabled' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            aria-label="Delete rule"
                            onClick={() => deleteAlertRule(firebaseUser.uid, rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: PREMIUM FEATURES */}
        {section === 'premium' && (
          <PremiumView
            isSignedIn={Boolean(firebaseUser)}
            uid={firebaseUser?.uid ?? null}
            currentPlan={account?.plan ?? 'free'}
            settings={appSettings}
            subscriptions={subscriptions}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {/* SECTION 5: ADMIN & OWNER EARNINGS DASHBOARD */}
        {section === 'admin' && (
          <AdminDashboard
            isAdmin={isAdmin}
            adminUid={firebaseUser?.uid ?? null}
            settings={appSettings}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-white/10 bg-[#050814]/80 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-bold chroma-text text-sm">CLIMORA</span>
            <span aria-hidden="true">·</span>
            <span>{t.slogan}</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setSection('forecast')}
              className="hover:text-white cursor-pointer"
            >
              {t.navForecast}
            </button>
            <button
              type="button"
              onClick={() => setSection('premium')}
              className="hover:text-white cursor-pointer"
            >
              {t.navPremium}
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hover:text-white cursor-pointer"
            >
              {t.account}
            </button>
          </div>
        </div>
      </footer>

      {/* Auth & Account Management Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        firebaseUser={firebaseUser}
        account={account}
        privateInfo={privateInfo}
        currentUnit={unit}
        currentLang={lang}
        currentTheme={chromaTheme}
        onPreferencesChange={(u, l, th) => {
          setUnit(u);
          setLang(l);
          setChromaTheme(th);
        }}
      />
    </div>
  );
}
