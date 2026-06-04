"use client";

import React from "react";
import { PieChart, Filter } from "lucide-react";

type Slice = { label: string; percent: number };

export function AllocationEngine({
  allocations
}: {
  allocations?: {
    assetClass?: Slice[];
    currency?: Slice[];
    broker?: Slice[];
    strategy?: Slice[];
  };
}) {
  const groups = [
    { label: "Exposure By Asset Class", data: allocations?.assetClass || [] },
    { label: "Exposure By Currency", data: allocations?.currency || [] },
    { label: "Exposure By Broker", data: allocations?.broker || [] },
    { label: "Exposure By Strategy", data: allocations?.strategy || [] }
  ];
  const hasData = groups.some((g) => g.data.some((x) => x.percent > 0));

  if (!hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
        No live allocation data. Sync MT5 accounts with open positions or equity.
      </div>
    );
  }

  const colors = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-indigo-500", "bg-slate-500"];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">Portfolio Allocation Engine</h3>
            <p className="text-xs text-slate-400">Live exposure from synced positions</p>
          </div>
        </div>
        <button type="button" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 border border-slate-700"><Filter className="w-4 h-4" /></button>
      </div>
      <div className="space-y-8">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{group.label}</span>
            {group.data.length ? (
              <>
                <div className="w-full h-3 flex rounded-full overflow-hidden bg-slate-800">
                  {group.data.map((item, i) => (
                    <div key={i} className={`${colors[i % colors.length]} h-full`} style={{ width: `${Math.max(item.percent, 1)}%` }} title={`${item.label}: ${item.percent}%`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {group.data.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-medium text-slate-200">{item.label}</span>
                      <span className="font-bold">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">No exposure recorded</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
