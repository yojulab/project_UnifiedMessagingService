'use client';

import { useState, type ReactElement } from 'react';
import { fmtNum } from '@/lib/client/format';

export interface DayPoint {
  day: string;
  SUCCESS: number;
  FAILED: number;
  BOUNCED: number;
}

const H = 200;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };
const BAR_MAX = 24;
const GAP = 2;
const R = 4;

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** 위쪽 모서리만 둥근 막대 경로 (기준선 쪽은 직각) */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** 일별 발송 결과 — 성공 / 실패·반송 누적 세로 막대 */
export function DailyChart({ data }: { data: DayPoint[] }): ReactElement {
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(480, data.length * 32 + PAD.left + PAD.right);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(1, ...data.map((d) => d.SUCCESS + d.FAILED + d.BOUNCED)));
  const band = plotW / Math.max(data.length, 1);
  const bw = Math.min(BAR_MAX, band * 0.6);
  const y = (v: number): number => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));

  return (
    <figure className="space-y-3" aria-label="일별 발송 추이">
      <div className="flex flex-wrap items-center gap-4 text-xs" aria-label="범례">
        <span className="inline-flex items-center gap-1.5"><span className="bg-chart-success inline-block h-2.5 w-2.5 rounded-sm" aria-hidden />성공</span>
        <span className="inline-flex items-center gap-1.5"><span className="bg-chart-fail inline-block h-2.5 w-2.5 rounded-sm" aria-hidden />실패 · 반송</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 ${data.length}일 일별 발송 결과`} className="h-auto w-full min-w-[480px] text-muted-foreground">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-chart-grid" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-current text-[10px]">{fmtNum(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + band * i + (band - bw) / 2;
            const fail = d.FAILED + d.BOUNCED;
            const sH = (d.SUCCESS / max) * plotH;
            const fH = (fail / max) * plotH;
            const base = PAD.top + plotH;
            const failGap = sH > 0 && fH > 0 ? GAP : 0;
            return (
              <g key={d.day}>
                {d.SUCCESS > 0 && (
                  fail > 0
                    ? <rect x={x} y={base - sH} width={bw} height={sH} className="fill-chart-success" />
                    : <path d={topRounded(x, base - sH, bw, sH, R)} className="fill-chart-success" />
                )}
                {fail > 0 && <path d={topRounded(x, base - sH - fH - failGap, bw, Math.max(fH, 1), R)} className="fill-chart-fail" />}
                {i % labelEvery === 0 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="fill-current text-[10px]">{d.day.slice(5)}</text>
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.day} 성공 ${d.SUCCESS}건, 실패 ${d.FAILED}건, 반송 ${d.BOUNCED}건`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="focus:outline-none"
                />
              </g>
            );
          })}
          {hover !== null && data[hover] && (() => {
            const d = data[hover];
            const cx = PAD.left + band * hover + band / 2;
            const tw = 132;
            const tx = Math.min(Math.max(cx - tw / 2, 2), W - tw - 2);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={2} width={tw} height={58} rx={6} className="fill-background stroke-chart-grid" strokeWidth={1} />
                <text x={tx + 8} y={18} className="fill-foreground text-[11px] font-semibold">{d.day}</text>
                <text x={tx + 8} y={33} className="fill-foreground text-[11px]">성공 {fmtNum(d.SUCCESS)}건</text>
                <text x={tx + 8} y={48} className="fill-foreground text-[11px]">실패 {fmtNum(d.FAILED)} · 반송 {fmtNum(d.BOUNCED)}</text>
              </g>
            );
          })()}
        </svg>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">표로 보기</summary>
        <table className="table-base mt-2">
          <thead><tr><th>일자</th><th className="text-right">성공</th><th className="text-right">실패</th><th className="text-right">반송</th></tr></thead>
          <tbody>
            {data.filter((d) => d.SUCCESS + d.FAILED + d.BOUNCED > 0).map((d) => (
              <tr key={d.day}><td>{d.day}</td><td className="text-right tabular-nums">{fmtNum(d.SUCCESS)}</td><td className="text-right tabular-nums">{fmtNum(d.FAILED)}</td><td className="text-right tabular-nums">{fmtNum(d.BOUNCED)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
