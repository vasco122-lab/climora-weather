import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { recordAdClick, recordAdImpression } from '../services/firestoreService';
import type { AdCampaign } from '../types/climora';

interface AdBannerProps {
  campaigns: AdCampaign[];
  isSignedIn: boolean;
  sponsoredLabel: string;
  removeAdsLabel: string;
  onUpgradeClick: () => void;
}

const FALLBACK_CAMPAIGN: AdCampaign = {
  id: 'climora_default_sponsor',
  sponsorName: 'AtmosHome Pro',
  headline: 'Hyper-Local Backyard Weather Station',
  description:
    'Pair live barometric sensors with CLIMORA alerts for precision micro-climate tracking at home.',
  ctaLabel: 'Explore Hardware',
  targetUrl: '#premium',
  cpmUsd: 6.5,
  cpcUsd: 0.85,
  impressions: 0,
  clicks: 0,
  active: true,
  createdAt: null,
  updatedAt: null,
};

export const AdBanner: React.FC<AdBannerProps> = ({
  campaigns,
  isSignedIn,
  sponsoredLabel,
  removeAdsLabel,
  onUpgradeClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const impressionSentFor = useRef<string | null>(null);

  const activeCampaign = campaigns[0] ?? FALLBACK_CAMPAIGN;
  const isPersistedCampaign = Boolean(campaigns[0]);

  useEffect(() => {
    if (
      isSignedIn &&
      isPersistedCampaign &&
      impressionSentFor.current !== activeCampaign.id
    ) {
      impressionSentFor.current = activeCampaign.id;
      recordAdImpression(activeCampaign).catch(() => {});
    }
  }, [activeCampaign, isPersistedCampaign, isSignedIn]);

  const handleCta = () => {
    if (isSignedIn && isPersistedCampaign) {
      recordAdClick(activeCampaign).catch(() => {});
    }
    if (activeCampaign.targetUrl.startsWith('http')) {
      window.open(activeCampaign.targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      onUpgradeClick();
    }
  };

  return (
    <section
      aria-label={sponsoredLabel}
      className="chroma-surface rounded-2xl p-5 grid grid-cols-1 md:grid-cols-[200px_1fr_auto] items-center gap-6"
    >
      <div className="relative h-32 w-full rounded-xl overflow-hidden bg-slate-900 border border-white/10">
        {!imgError ? (
          <img
            src="/src/assets/images/climora_sponsor_gear_1794992401982.jpg"
            alt={activeCampaign.sponsorName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-amber-500/20">
            <Sparkles className="w-7 h-7 text-cyan-300" />
          </div>
        )}
      </div>

      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{sponsoredLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200 font-medium">{activeCampaign.sponsorName}</span>
        </div>
        <h3 className="text-lg font-semibold text-white truncate">{activeCampaign.headline}</h3>
        <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">
          {activeCampaign.description}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2.5 shrink-0">
        <button
          type="button"
          onClick={handleCta}
          className="chroma-btn px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <span>{activeCampaign.ctaLabel}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onUpgradeClick}
          className="text-xs text-slate-400 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {removeAdsLabel}
        </button>
      </div>
    </section>
  );
};
