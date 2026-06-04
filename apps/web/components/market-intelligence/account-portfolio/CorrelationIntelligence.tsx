"use client";

import React from "react";

type CorrelationPayload = {
  labels?: string[];
  values?: number[][];
};

export function CorrelationIntelligence({ fullWidth, correlations }: { fullWidth?: boolean; correlations?: CorrelationPayload }) {
  const labels = correlations?.labels?.length ? correlations.labels : [];
  const matrix = correlations?.values?.length ? correlations.values : [];
  if (!labels.length) {
    return (
      <section className={`rounded-xl border border-slate-800 bg-slate-900 p-6 ${fullWidth ? "col-span-full" : ""}`}>
        <h2 className="text-lg font-semibold text-white mb-2">Correlation Intelligence</h2>
        <p className="text-sm text-slate-400">No open positions available to compute live correlation matrix.</p>
      </section>
    );
  }
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900 p-6 ${fullWidth ? "col-span-full" : ""}`}>
      <h2 className="text-lg font-semibold text-white mb-4">Correlation Intelligence</h2>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono">
          <thead><tr><th className="p-2" /><th>{labels.map((l) => <th key={l} className="p-2 text-slate-400">{l}</th>)}</tr></thead>
          <tbody>{labels.map((row, i) => (
            <tr key={row}><td className="p-2 text-slate-400">{row}</td>{matrix[i].map((v, j) => (
              <td key={j} className={`p-2 text-center rounded ${v >= 0.7 ? "bg-green-900/40 text-green-300" : v <= -0.2 ? "bg-red-900/40 text-red-300" : "bg-slate-800 text-slate-300"}`}>{v.toFixed(2)}</td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
