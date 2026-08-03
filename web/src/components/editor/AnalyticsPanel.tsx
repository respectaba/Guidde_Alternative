"use client";
import { useEffect, useState } from "react";

interface Stats {
  views: number;
  completions: number;
  completionRate: number;
  last7: { date: string; views: number }[];
}

/** Compact viewer-analytics summary for the guide owner (editor sidebar). */
export function AnalyticsPanel({ guideId }: { guideId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/guides/${guideId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setStats(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [guideId]);

  if (!stats) return null;
  const max = Math.max(1, ...stats.last7.map((d) => d.views));

  return (
    <div className="caption-editor">
      <label className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
        Analytics
      </label>
      <div className="row" style={{ gap: 16 }}>
        <Stat label="Views" value={stats.views} />
        <Stat label="Completions" value={stats.completions} />
        <Stat label="Completion" value={`${Math.round(stats.completionRate * 100)}%`} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 42, marginTop: 4 }}>
        {stats.last7.map((d) => (
          <div key={d.date} style={{ flex: 1, textAlign: "center" }} title={`${d.date}: ${d.views}`}>
            <div
              style={{
                height: `${Math.round((d.views / max) * 34)}px`,
                minHeight: 2,
                background: "var(--accent)",
                borderRadius: 3,
                opacity: d.views ? 1 : 0.3,
              }}
            />
            <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>
              {d.date.slice(5)}
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        Views from the public link &amp; embeds (last 7 days).
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 11 }}>
        {label}
      </div>
    </div>
  );
}
