"use client";

import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Activity, ShieldAlert, BarChart3 } from "lucide-react";

function fmtMoney(n?: number | null) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function fmtPct(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function ExecutiveKpiCards({ summary }: { summary?: Record<string, unknown> }) {
  const s = summary || {};
  const kpis = [
    { label: "Total Portfolio Value", value: fmtMoney(s.portfolioValue as number), subValue: "Consolidated equity", icon: <DollarSign className="w-5 h-5" />, color: "blue" },
    { label: "Floating P/L", value: fmtMoney(s.floatingPL as number), subValue: "Open positions", icon: <Activity className="w-5 h-5" />, color: Number(s.floatingPL) >= 0 ? "green" : "red" },
    { label: "Daily Return", value: fmtPct(s.dailyReturnPercent as number), subValue: "Balance vs equity", icon: <TrendingUp className="w-5 h-5" />, color: "green" },
    { label: "Current Drawdown", value: fmtPct(s.currentDrawdownPercent as number), subValue: "From equity peak", icon: <TrendingDown className="w-5 h-5" />, color: "amber" },
    { label: "Portfolio Risk", value: String(s.portfolioRiskScore || "—"), subValue: "Live composite", icon: <ShieldAlert className="w-5 h-5" />, color: "purple" },
    { label: "Monthly Return", value: fmtPct(s.monthlyReturnPercent as number), subValue: "From equity history", icon: <BarChart3 className="w-5 h-5" />, color: "blue" }
  ];

  const getColorClasses = (color: string) => ({
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  }[color] || "bg-blue-500/10 text-blue-500 border-blue-500/20");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
            <div className={`p-2 rounded-lg border ${getColorClasses(kpi.color)}`}>{kpi.icon}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs text-slate-400 font-medium">{kpi.subValue}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
