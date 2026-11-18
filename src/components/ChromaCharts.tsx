import React, { useState } from 'react';
import { formatTemp } from '../services/weatherService';
import type { UnitSystem } from '../types/climora';

interface HourlyChartProps {
  times: string[];
  temps: number[];
  rainProbs: number[];
  unit: UnitSystem;
}

export const HourlySpectrumChart: React.FC<HourlyChartProps> = ({
  times,
  temps,
  rainProbs,
  unit,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const count = Math.min(24, times.length, temps.length);
  if (count < 2) return null;

  const sliceTimes = times.slice(0, count);
  const sliceTemps = temps.slice(0, count);
  const sliceRain = rainProbs.slice(0, count);

  const minT = Math.min(...sliceTemps);
  const maxT = Math.max(...sliceTemps);
  const rangeT = Math.max(2, maxT - minT);

  const width = 760;
  const height = 220;
  const padX = 28;
  const padTop = 28;
  const padBottom = 38;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const points = sliceTemps.map((t, i) => {
    const x = padX + (i / (count - 1)) * chartW;
    const y = padTop + chartH - ((t - minT) / rangeT) * chartH;
    return { x, y, t, rain: sliceRain[i] ?? 0, time: sliceTimes[i] };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padBottom} L ${points[0].x.toFixed(1)} ${height - padBottom} Z`;

  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 rounded bg-cyan-400" />
            <span>Temperature Curve</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-violet-500/50 border border-violet-400/60" />
            <span>Rain Probability</span>
          </span>
        </div>
        {activePoint && (
          <div className="font-mono tabular-nums text-slate-200">
            <span>{activePoint.time.slice(11, 16)}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="font-semibold text-cyan-300">{formatTemp(activePoint.t, unit)}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-violet-300">{activePoint.rain}% rain</span>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[540px] h-52 select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="hourly-line-spectrum" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--chroma-c1)" />
              <stop offset="35%" stopColor="var(--chroma-c2)" />
              <stop offset="70%" stopColor="var(--chroma-c3)" />
              <stop offset="100%" stopColor="var(--chroma-c4)" />
            </linearGradient>
            <linearGradient id="hourly-area-spectrum" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--chroma-c2)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--chroma-c1)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal baseline */}
          <line
            x1={padX}
            y1={height - padBottom}
            x2={width - padX}
            y2={height - padBottom}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Rain probability bars */}
          {points.map((p, i) => {
            const barH = (p.rain / 100) * (chartH * 0.55);
            return (
              <rect
                key={p.time}
                x={p.x - 6}
                y={height - padBottom - barH}
                width={12}
                height={Math.max(2, barH)}
                rx="3"
                fill="var(--chroma-c2)"
                fillOpacity={hoverIdx === i ? 0.55 : 0.24}
              />
            );
          })}

          {/* Temperature gradient fill & curve */}
          <path d={areaPath} fill="url(#hourly-area-spectrum)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#hourly-line-spectrum)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive nodes & time labels */}
          {points.map((p, i) => (
            <g key={p.time} onMouseEnter={() => setHoverIdx(i)} className="cursor-pointer">
              <rect
                x={p.x - chartW / (count * 2)}
                y={0}
                width={chartW / count}
                height={height}
                fill="transparent"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIdx === i ? 5.5 : 3}
                fill={hoverIdx === i ? '#ffffff' : 'var(--chroma-c1)'}
                stroke="var(--chroma-c3)"
                strokeWidth={hoverIdx === i ? 2.5 : 1.5}
              />
              {i % 3 === 0 && (
                <text
                  x={p.x}
                  y={height - 14}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {p.time.slice(11, 16)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

interface DailyRangeChartProps {
  dates: string[];
  mins: number[];
  maxs: number[];
  unit: UnitSystem;
}

export const DailyThermalRangeBars: React.FC<DailyRangeChartProps> = ({
  dates,
  mins,
  maxs,
  unit,
}) => {
  const globalMin = Math.min(...mins);
  const globalMax = Math.max(...maxs);
  const span = Math.max(1, globalMax - globalMin);

  return (
    <div className="space-y-2.5">
      {dates.map((dateStr, idx) => {
        const minV = mins[idx];
        const maxV = maxs[idx];
        const leftPct = ((minV - globalMin) / span) * 100;
        const widthPct = Math.max(8, ((maxV - minV) / span) * 100);
        const dayLabel =
          idx === 0
            ? 'Today'
            : new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

        return (
          <div
            key={dateStr}
            className="grid grid-cols-[110px_54px_1fr_54px] items-center gap-3 text-sm py-1.5 border-b border-white/5 last:border-0"
          >
            <span className="text-slate-200 font-medium truncate">{dayLabel}</span>
            <span className="font-mono tabular-nums text-right text-cyan-300">
              {formatTemp(minV, unit, false)}
            </span>
            <div className="h-2 rounded-full bg-white/10 relative overflow-hidden">
              <div
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.min(100 - leftPct, widthPct)}%`,
                  background:
                    'linear-gradient(90deg, var(--chroma-c1), var(--chroma-c2), var(--chroma-c3), var(--chroma-c4))',
                }}
              />
            </div>
            <span className="font-mono tabular-nums text-amber-300 font-semibold">
              {formatTemp(maxV, unit, false)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface RevenueBreakdownProps {
  subscriptions: number;
  ads: number;
  sponsorships: number;
  addons: number;
}

export const OwnerRevenueBreakdownChart: React.FC<RevenueBreakdownProps> = ({
  subscriptions,
  ads,
  sponsorships,
  addons,
}) => {
  const total = Math.max(0.01, subscriptions + ads + sponsorships + addons);
  const rows = [
    { label: 'Premium Subscriptions', value: subscriptions, color: 'from-cyan-400 to-blue-500' },
    { label: 'Sponsorships', value: sponsorships, color: 'from-fuchsia-400 to-pink-500' },
    { label: 'Advertisements (CPM/CPC)', value: ads, color: 'from-amber-400 to-orange-500' },
    { label: 'Paid Feature Add-Ons', value: addons, color: 'from-emerald-400 to-teal-500' },
  ];

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const pct = Math.round((row.value / total) * 100);
        return (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">{row.label}</span>
              <span className="font-mono tabular-nums text-slate-300">
                ${row.value.toFixed(2)} ({pct}%)
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${row.color} transition-all duration-300`}
                style={{ width: `${Math.max(row.value > 0 ? 4 : 0, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
