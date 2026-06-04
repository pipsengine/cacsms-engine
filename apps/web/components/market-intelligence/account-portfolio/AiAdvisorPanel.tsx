"use client";

import React from "react";
import { Brain, Sparkles, AlertCircle, TrendingUp, ShieldCheck } from "lucide-react";

type Insight = { insight_type: string; content: string; created_at?: string };

export function AiAdvisorPanel({ insights = [] }: { insights?: Insight[] }) {
  if (!insights.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
        AI insights appear after live accounts sync and portfolio metrics are computed.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-xl shadow-blue-900/5">
      <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">AI Portfolio Advisor</h3>
            <p className="text-xs text-slate-400">Computed from live portfolio state</p>
          </div>
        </div>
        <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Live
        </div>
      </div>
      <div className="p-4 flex-1 space-y-4">
        {insights.map((insight, i) => (
          <div key={i} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              {insight.insight_type.includes("Risk") || insight.insight_type.includes("Warning") ? (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              ) : insight.insight_type.includes("Performance") ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{insight.insight_type}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{insight.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
