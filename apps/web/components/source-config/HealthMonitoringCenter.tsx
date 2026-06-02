"use client";

import { useEffect } from "react";
import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  health: Array<{
    sourceKey: string;
    source: string;
    health: string;
    freshness: string;
    latencyMs: number | null;
    availability: string;
  }>;
  onRefresh: () => void;
};

export function HealthMonitoringCenter({ health, onRefresh }: Props) {
  useEffect(() => {
    const timer = setInterval(onRefresh, 30000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  return (
    <section className="sc-panel">
      <div className="sc-panel-head"><h2>Health Monitoring Center</h2><b>LIVE / 30s REFRESH</b></div>
      <div className="sc-table-wrap">
        <table>
          <thead><tr><th>Source</th><th>Health</th><th>Freshness</th><th>Latency</th><th>Availability</th></tr></thead>
          <tbody>
            {health.map((row) => (
              <tr key={row.sourceKey}>
                <td>{row.source}</td>
                <td>{row.health}</td>
                <td>{row.freshness}</td>
                <td>{row.latencyMs != null ? `${row.latencyMs} ms` : "—"}</td>
                <td>{row.availability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
