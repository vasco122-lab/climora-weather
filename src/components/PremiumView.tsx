import React, { useState } from 'react';
import { Check, Crown, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { cancelSubscription, purchasePlanOrAddon } from '../services/firestoreService';
import type { AppSettings, PlanTier, SubscriptionRecord } from '../types/climora';

interface PremiumViewProps {
  isSignedIn: boolean;
  uid: string | null;
  currentPlan: PlanTier;
  settings: AppSettings;
  subscriptions: SubscriptionRecord[];
  onOpenAuth: () => void;
}

export const PremiumView: React.FC<PremiumViewProps> = ({
  isSignedIn,
  uid,
  currentPlan,
  settings,
  subscriptions,
  onOpenAuth,
}) => {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCheckout = async (
    planId: 'pro_monthly' | 'pro_annual' | 'storm_radar_pack' | 'ad_free_pass',
    amountUsd: number,
    billingCycle: 'monthly' | 'annual' | 'one_time'
  ) => {
    if (!isSignedIn || !uid) {
      onOpenAuth();
      return;
    }
    setBusyPlan(planId);
    setFeedback(null);
    try {
      await purchasePlanOrAddon({ uid, planId, amountUsd, billingCycle });
      setFeedback(`Activated ${planId.replace(/_/g, ' ')} ($${amountUsd.toFixed(2)}).`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setBusyPlan(null);
    }
  };

  const handleCancel = async (sub: SubscriptionRecord) => {
    if (!uid) return;
    setBusyPlan(sub.id);
    try {
      const wasPro = sub.planId === 'pro_monthly' || sub.planId === 'pro_annual';
      await cancelSubscription(uid, sub.id, wasPro);
      setFeedback('Subscription cancelled.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to cancel.');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-3xl font-bold chroma-text">CLIMORA Pro &amp; Paid Features</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Unlock 16-day extended forecasts, unlimited worldwide saved cities, deep atmospheric AI analysis, custom threshold weather alerts, and an ad-free sky.
          </p>
        </div>
        <div className="text-xs text-slate-300 font-mono tabular-nums">
          Current Tier: <span className="text-white font-semibold uppercase">{currentPlan.replace('_', ' ')}</span>
        </div>
      </div>

      {feedback && (
        <div className="chroma-surface rounded-xl px-4 py-3 text-sm text-cyan-200 border border-cyan-400/30">
          {feedback}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Explorer */}
        <div className="chroma-surface rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">For everyday weather checks</div>
              <h3 className="text-xl font-bold text-white">Explorer Free</h3>
              <div className="text-3xl font-bold font-mono tabular-nums text-white pt-1">
                $0 <span className="text-xs font-normal text-slate-400">/ forever</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>7-day forecast &amp; 24h hourly curve</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>Up to 3 saved world locations</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>Live severe weather advisories</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>Sponsored partner placements</span>
              </li>
            </ul>
          </div>
          <div className="text-xs text-slate-400 py-2.5 text-center border border-white/10 rounded-xl">
            {currentPlan === 'free' ? 'Active Plan' : 'Included Base Tier'}
          </div>
        </div>

        {/* Pro Monthly */}
        <div className="chroma-surface chroma-surface-bright rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-cyan-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                <span>For weather enthusiasts &amp; commuters</span>
              </div>
              <h3 className="text-xl font-bold chroma-text">CLIMORA Pro Monthly</h3>
              <div className="text-3xl font-bold font-mono tabular-nums text-white pt-1">
                ${settings.proMonthlyPrice.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ month</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-200">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>16-day extended worldwide forecasts</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Unlimited saved towns &amp; cities</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Custom rain, wind &amp; thermal alerts</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Deep AI smart predictions &amp; Ad-free UI</span>
              </li>
            </ul>
          </div>
          <button
            type="button"
            disabled={busyPlan === 'pro_monthly' || currentPlan === 'pro_monthly'}
            onClick={() => handleCheckout('pro_monthly', settings.proMonthlyPrice, 'monthly')}
            className="chroma-btn py-2.5 px-4 rounded-xl text-sm whitespace-nowrap disabled:opacity-60"
          >
            {currentPlan === 'pro_monthly'
              ? 'Active Pro Monthly'
              : busyPlan === 'pro_monthly'
                ? 'Activating...'
                : isSignedIn
                  ? 'Upgrade to Pro Monthly'
                  : 'Sign In to Upgrade'}
          </button>
        </div>

        {/* Pro Annual */}
        <div className="chroma-surface rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>For frequent travelers · Save 25%</span>
              </div>
              <h3 className="text-xl font-bold text-white">CLIMORA Pro Annual</h3>
              <div className="text-3xl font-bold font-mono tabular-nums text-white pt-1">
                ${settings.proAnnualPrice.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ year</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Everything in CLIMORA Pro Monthly</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Priority storm &amp; travel window analysis</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>All 4 animated Spectrum themes unlocked</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Zero advertisements across every screen</span>
              </li>
            </ul>
          </div>
          <button
            type="button"
            disabled={busyPlan === 'pro_annual' || currentPlan === 'pro_annual'}
            onClick={() => handleCheckout('pro_annual', settings.proAnnualPrice, 'annual')}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-sm font-semibold text-white transition-colors whitespace-nowrap disabled:opacity-60"
          >
            {currentPlan === 'pro_annual'
              ? 'Active Pro Annual'
              : busyPlan === 'pro_annual'
                ? 'Activating...'
                : 'Choose Pro Annual'}
          </button>
        </div>
      </div>

      {/* Optional Paid Feature Packs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="chroma-surface rounded-2xl p-6 flex items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-fuchsia-300">
              <Zap className="w-4 h-4" />
              <span>One-Time Paid Feature</span>
            </div>
            <h4 className="text-lg font-bold text-white">Storm Radar &amp; Lightning Pack</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Add high-sensitivity storm &amp; wind gust alerts for maritime and mountain routes.
            </p>
          </div>
          <button
            type="button"
            disabled={busyPlan === 'storm_radar_pack'}
            onClick={() => handleCheckout('storm_radar_pack', 7.99, 'one_time')}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white font-mono tabular-nums whitespace-nowrap shrink-0"
          >
            $7.99 Buy
          </button>
        </div>

        <div className="chroma-surface rounded-2xl p-6 flex items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <ShieldAlert className="w-4 h-4" />
              <span>One-Time Paid Feature</span>
            </div>
            <h4 className="text-lg font-bold text-white">Ad-Free Season Pass</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Remove sponsored partner cards for 90 days without a recurring subscription.
            </p>
          </div>
          <button
            type="button"
            disabled={busyPlan === 'ad_free_pass'}
            onClick={() => handleCheckout('ad_free_pass', 3.49, 'one_time')}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white font-mono tabular-nums whitespace-nowrap shrink-0"
          >
            $3.49 Buy
          </button>
        </div>
      </div>

      {/* Active Billing History */}
      {isSignedIn && subscriptions.length > 0 && (
        <div className="chroma-surface rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Your Subscriptions &amp; Passes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Cycle</th>
                  <th className="py-2.5 pr-4">Amount</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 font-medium text-white capitalize">
                      {sub.planId.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-4 text-slate-300 capitalize">{sub.billingCycle}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-cyan-300">
                      ${sub.amountUsd.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          sub.status === 'active' ? 'text-emerald-300' : 'text-slate-400'
                        }
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {sub.status === 'active' && (
                        <button
                          type="button"
                          disabled={busyPlan === sub.id}
                          onClick={() => handleCancel(sub)}
                          className="text-xs text-rose-300 hover:text-rose-200 underline underline-offset-4"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
