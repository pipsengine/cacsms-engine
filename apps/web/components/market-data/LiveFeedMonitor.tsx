"use client";

import { useEffect, useState } from "react";

export function LiveFeedMonitor({ feed }: { feed: Array<Record<string, unknown>> }) {
  const [rows, setRows] = useState(feed);
  useEffect(() => setRows(feed), [feed]);
  useEffect(() => {
    const timer = setInterval(() => setRows((current) => current.map((row) => row.status === "HEALTHY" && row.bid != null ? { ...row, lastTick: new Date().toISOString() } : row)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Live Feed Monitor</h2><b>1s REFRESH</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Bid</th><th>Ask</th><th>Spread</th><th>Last Tick</th><th>Provider</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.symbol)} className={`mdoc-feed-${String(row.status).toLowerCase()}`}>
                <td>{String(row.symbol)}</td><td>{row.bid ?? "—"}</td><td>{row.ask ?? "—"}</td><td>{row.spread ?? "—"}</td>
                <td>{row.lastTick ? new Date(String(row.lastTick)).toLocaleTimeString() : "—"}</td><td>{String(row.provider)}</td>
                <td>{String(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
