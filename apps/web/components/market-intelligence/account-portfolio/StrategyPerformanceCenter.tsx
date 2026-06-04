"use client";

import React from "react";

type Strategy = {
  strategy: string;
  trades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  drawdown: number;
  riskScore: number;
  status: string;
};

export function StrategyPerformanceCenter({ strategies = [] }: { strategies?: Strategy[] }) {
  const rows = strategies.length ? strategies : [
    { strategy: "Swing Trading", trades: 24, winRate: 62.5, profitFactor: 1.74, netProfit: 2180, drawdown: 1.8, riskScore: 26, status: "Active" }
  ];
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Strategy Performance Center</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-300">
          <thead><tr className="text-left text-slate-500 uppercase text-xs">{["Strategy", "Trades", "Win Rate", "PF", "Net Profit", "DD", "Risk", "Status"].map((h) => <th key={h} className="pb-3 pr-4">{h}</th>)}</tr></thead>
          <tbody>{rows.map((s) => <tr key={s.strategy} className="border-t border-slate-800"><td className="py-2 pr-4">{s.strategy}</td><td>{s.trades}</td><td>{s.winRate}%</td><td>{s.profitFactor}</td><td>${s.netProfit}</td><td>{s.drawdown}%</td><td>{s.riskScore}</td><td>{s.status}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
