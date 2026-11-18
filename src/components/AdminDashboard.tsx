import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  DollarSign,
  Megaphone,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  createAdminCampaign,
  fetchAdminDashboardData,
  recordSponsorshipDeal,
  saveAdminAppSettings,
  toggleCampaignActive,
} from '../services/firestoreService';
import type {
  AdCampaign,
  AppSettings,
  RevenueEvent,
  SubscriptionRecord,
  UserAccount,
} from '../types/climora';
import { OwnerRevenueBreakdownChart } from './ChromaCharts';

interface AdminDashboardProps {
  isAdmin: boolean;
  adminUid: string | null;
  settings: AppSettings;
  onOpenAuth: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isAdmin,
  adminUid,
  settings,
  onOpenAuth,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [revenueEvents, setRevenueEvents] = useState<RevenueEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Settings form
  const [adsEnabled, setAdsEnabled] = useState(settings.adsEnabled);
  const [proMonthlyPrice, setProMonthlyPrice] = useState(String(settings.proMonthlyPrice));
  const [proAnnualPrice, setProAnnualPrice] = useState(String(settings.proAnnualPrice));
  const [defaultForecastDays, setDefaultForecastDays] = useState(String(settings.defaultForecastDays));
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);

  // New Campaign form
  const [sponsorName, setSponsorName] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Learn More');
  const [targetUrl, setTargetUrl] = useState('#premium');
  const [cpmUsd, setCpmUsd] = useState('6.50');
  const [cpcUsd, setCpcUsd] = useState('0.85');

  // Direct sponsorship entry
  const [dealSponsor, setDealSponsor] = useState('');
  const [dealAmount, setDealAmount] = useState('150');

  useEffect(() => {
    setAdsEnabled(settings.adsEnabled);
    setProMonthlyPrice(String(settings.proMonthlyPrice));
    setProAnnualPrice(String(settings.proAnnualPrice));
    setDefaultForecastDays(String(settings.defaultForecastDays));
    setAnnouncement(settings.announcement);
    setMaintenanceMode(settings.maintenanceMode);
  }, [settings]);

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAdminDashboardData();
      setUsers(data.users);
      setSubscriptions(data.subscriptions);
      setCampaigns(data.campaigns);
      setRevenueEvents(data.revenueEvents);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin console data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isAdmin) {
    return (
      <div className="chroma-surface rounded-2xl p-8 max-w-xl mx-auto text-center space-y-4">
        <ShieldCheck className="w-10 h-10 text-cyan-300 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Owner &amp; Admin Console</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Sign in with the verified owner administrator account to monitor registered users, active sessions, owner earnings, ad campaigns, subscriptions, and global app settings.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="chroma-btn px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
        >
          Sign In as Owner
        </button>
      </div>
    );
  }

  const subRevenue = revenueEvents
    .filter((e) => e.source === 'subscription')
    .reduce((acc, e) => acc + e.amountUsd, 0);
  const adRevenue = revenueEvents
    .filter((e) => e.source === 'ad_impression' || e.source === 'ad_click')
    .reduce((acc, e) => acc + e.amountUsd, 0);
  const sponsorshipRevenue = revenueEvents
    .filter((e) => e.source === 'sponsorship')
    .reduce((acc, e) => acc + e.amountUsd, 0);
  const addonRevenue = revenueEvents
    .filter((e) => e.source === 'paid_addon')
    .reduce((acc, e) => acc + e.amountUsd, 0);
  const totalRevenue = subRevenue + adRevenue + sponsorshipRevenue + addonRevenue;

  const activeUsersCount = users.filter((u) => {
    const ts = u.lastActiveAt as { toMillis?: () => number } | null;
    if (!ts?.toMillis) return true;
    return Date.now() - ts.toMillis() < 24 * 60 * 60 * 1000;
  }).length;

  const activeSubsCount = subscriptions.filter((s) => s.status === 'active').length;
  const totalImpressions = campaigns.reduce((a, c) => a + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((a, c) => a + (c.clicks || 0), 0);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await saveAdminAppSettings({
        adsEnabled,
        proMonthlyPrice: Math.max(0, Number(proMonthlyPrice) || 4.99),
        proAnnualPrice: Math.max(0, Number(proAnnualPrice) || 44.99),
        defaultForecastDays: Math.min(16, Math.max(3, Number(defaultForecastDays) || 7)),
        announcement,
        maintenanceMode,
      });
      setStatusMsg('Global CLIMORA settings updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !headline.trim()) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await createAdminCampaign({
        sponsorName: sponsorName.trim(),
        headline: headline.trim(),
        description: description.trim() || 'Featured CLIMORA weather sponsor.',
        ctaLabel: ctaLabel.trim() || 'Visit Sponsor',
        targetUrl: targetUrl.trim() || '#premium',
        cpmUsd: Number(cpmUsd) || 5,
        cpcUsd: Number(cpcUsd) || 0.5,
      });
      setSponsorName('');
      setHeadline('');
      setDescription('');
      setStatusMsg('Ad campaign launched.');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create campaign.');
    }
  };

  const handleRecordSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUid || !dealSponsor.trim()) return;
    setStatusMsg(null);
    try {
      await recordSponsorshipDeal({
        sponsorName: dealSponsor.trim(),
        amountUsd: Math.max(0, Number(dealAmount) || 0),
        uid: adminUid,
      });
      setDealSponsor('');
      setStatusMsg('Sponsorship revenue recorded in ledger.');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to record sponsorship.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold chroma-text">Owner &amp; Admin Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor users, owner earnings across ads/subscriptions/sponsorships, and global platform controls.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-2 whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
          {statusMsg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="chroma-surface rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white">{users.length}</div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {activeUsersCount} active in 24h
          </div>
        </div>

        <div className="chroma-surface rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Owner Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums chroma-text">
            ${totalRevenue.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {revenueEvents.length} recorded events
          </div>
        </div>

        <div className="chroma-surface rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Subscriptions</span>
            <Activity className="w-4 h-4 text-fuchsia-300" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white">
            {activeSubsCount}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            ${subRevenue.toFixed(2)} subscription total
          </div>
        </div>

        <div className="chroma-surface rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ad Performance</span>
            <Megaphone className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white">
            {totalImpressions}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {totalClicks} clicks · ${adRevenue.toFixed(2)} earned
          </div>
        </div>
      </div>

      {/* Revenue Breakdown + Direct Sponsorship */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chroma-surface rounded-2xl p-6 space-y-5">
          <h3 className="text-lg font-bold text-white">Owner Earnings Breakdown</h3>
          <OwnerRevenueBreakdownChart
            subscriptions={subRevenue}
            ads={adRevenue}
            sponsorships={sponsorshipRevenue}
            addons={addonRevenue}
          />
          <form onSubmit={handleRecordSponsorship} className="pt-4 border-t border-white/10 space-y-3">
            <div className="text-xs font-semibold text-slate-300">Log Direct Sponsorship Deal</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-2.5">
              <input
                type="text"
                required
                value={dealSponsor}
                onChange={(e) => setDealSponsor(e.target.value)}
                placeholder="Sponsor partner name"
                className="rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                className="rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white font-mono tabular-nums"
              />
              <button
                type="submit"
                className="chroma-btn px-4 py-2 rounded-xl text-xs whitespace-nowrap"
              >
                Record Deal
              </button>
            </div>
          </form>
        </div>

        {/* Global App Settings */}
        <form onSubmit={handleSaveSettings} className="chroma-surface rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-300" />
            <h3 className="text-lg font-bold text-white">Global App Settings</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-xs text-slate-300">
              <span>Pro Monthly ($)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={proMonthlyPrice}
                onChange={(e) => setProMonthlyPrice(e.target.value)}
                className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-sm text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Pro Annual ($)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={proAnnualPrice}
                onChange={(e) => setProAnnualPrice(e.target.value)}
                className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-sm text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Free Days (3-16)</span>
              <input
                type="number"
                min="3"
                max="16"
                value={defaultForecastDays}
                onChange={(e) => setDefaultForecastDays(e.target.value)}
                className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-sm text-white font-mono tabular-nums"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs text-slate-300">
            <span>Global Announcement Banner</span>
            <input
              type="text"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-sm text-white"
            />
          </label>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-200">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(e) => setAdsEnabled(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Show Sponsored Ads to Free Users</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="accent-rose-400"
              />
              <span>Maintenance Banner</span>
            </label>
          </div>

          <button type="submit" className="chroma-btn px-5 py-2.5 rounded-xl text-xs whitespace-nowrap">
            Save App Settings
          </button>
        </form>
      </div>

      {/* Ad Campaigns Manager */}
      <div className="chroma-surface rounded-2xl p-6 space-y-5">
        <h3 className="text-lg font-bold text-white">Advertisement &amp; Sponsorship Campaigns</h3>
        <form onSubmit={handleCreateCampaign} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            required
            placeholder="Sponsor Name"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            className="rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white"
          />
          <input
            type="text"
            required
            placeholder="Ad Headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="md:col-span-2 rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white"
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="CPM $"
            value={cpmUsd}
            onChange={(e) => setCpmUsd(e.target.value)}
            className="rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white font-mono tabular-nums"
          />
          <button
            type="submit"
            className="chroma-btn px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Campaign</span>
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400">
                <th className="py-2.5 pr-4">Sponsor</th>
                <th className="py-2.5 pr-4">Headline</th>
                <th className="py-2.5 pr-4">CPM / CPC</th>
                <th className="py-2.5 pr-4">Impressions</th>
                <th className="py-2.5 pr-4">Clicks</th>
                <th className="py-2.5 text-right">State</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-xs text-slate-400">
                    No custom campaigns created yet. Default partner placement is active when ads are enabled.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 font-medium text-white">{camp.sponsorName}</td>
                    <td className="py-3 pr-4 text-slate-300">{camp.headline}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-slate-300">
                      ${camp.cpmUsd.toFixed(2)} / ${camp.cpcUsd.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-cyan-300">
                      {camp.impressions}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-amber-300">
                      {camp.clicks}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleCampaignActive(camp.id, !camp.active);
                          loadData();
                        }}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white"
                      >
                        {camp.active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users & Recent Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chroma-surface rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Registered Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Lang</th>
                  <th className="py-2 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-white">{u.displayName}</td>
                    <td className="py-2.5 pr-4 text-cyan-300 capitalize">{u.plan.replace('_', ' ')}</td>
                    <td className="py-2.5 pr-4 text-slate-300 uppercase">{u.preferredLang}</td>
                    <td className="py-2.5 text-right text-slate-300 capitalize">{u.preferredUnit}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-xs text-slate-400">
                      No registered user records loaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chroma-surface rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Recent Revenue Ledger</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {revenueEvents.slice(0, 10).map((ev) => (
                  <tr key={ev.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-4 text-white truncate max-w-[200px]">{ev.label}</td>
                    <td className="py-2.5 pr-4 text-slate-300 capitalize">
                      {ev.source.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-emerald-300">
                      +${ev.amountUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {revenueEvents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-xs text-slate-400">
                      Revenue events from subscriptions, ads, and sponsorships will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
