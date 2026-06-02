"use client";

import { humanDuration, realtimeRatio } from "@/lib/format";

export interface GenStats {
  generation_time_ms: number;
  audio_duration_s: number;
  word_count: number;
}

export default function StatsBar({ stats }: { stats: GenStats }) {
  const items = [
    ["Generation time", `${(stats.generation_time_ms / 1000).toFixed(1)}s`],
    ["Audio duration", humanDuration(stats.audio_duration_s)],
    ["Ratio", realtimeRatio(stats.audio_duration_s, stats.generation_time_ms)],
  ];

  return (
    <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
      {items.map(([label, value]) => (
        <div key={label}>
          <span className="text-muted">{label}: </span>
          <span className="text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}
