import React from "react";
import { Activity, Target, Shield, Clock, ExternalLink } from "lucide-react";

export function OpenPositionsDashboard({ positions }: { positions: any[] }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live Open Positions</h2>
            <p className="text-xs text-slate-400">Real-time tracking of active market exposure</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Floating P/L</span>
            <span className={`text-lg font-bold ${positions?.reduce((s, p) => s + p.floatingPL, 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {positions?.reduce((s, p) => s + p.floatingPL, 0) >= 0 ? '+' : ''}
              ${positions?.reduce((s, p) => s + p.floatingPL, 0).toLocaleString()}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500 uppercase px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">
            {positions?.length || 0} POSITIONS
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/50">
              <th className="px-6 py-4">Instrument</th>
              <th className="px-4 py-4">Account / Broker</th>
              <th className="px-4 py-4 text-center">Type</th>
              <th className="px-4 py-4 text-right">Size</th>
              <th className="px-4 py-4 text-right">Entry</th>
              <th className="px-4 py-4 text-right">Current</th>
              <th className="px-4 py-4 text-center">Protection</th>
              <th className="px-4 py-4 text-right">Floating P/L</th>
              <th className="px-4 py-4 text-center">Risk %</th>
              <th className="px-4 py-4 text-center">Duration</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {positions?.map((pos) => {
              const openTime = new Date(pos.openTime);
              const durationMs = Date.now() - openTime.getTime();
              const hours = Math.floor(durationMs / (1000 * 60 * 60));
              const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

              return (
                <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-10 rounded-full ${pos.direction === 'Buy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white uppercase tracking-tight">{pos.instrument}</span>
                        <span className="text-[10px] font-medium text-slate-500">{pos.strategy || 'Manual Trade'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-300">Account #{pos.accountId.slice(-4)}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{pos.brokerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                      pos.direction === 'Buy' ? 'text-green-400 bg-green-500/10 border border-green-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'
                    }`}>
                      {pos.direction}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">
                    {pos.lotSize?.toFixed(2)} Lots
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-400">
                    {pos.entryPrice?.toFixed(5)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm font-bold text-white">
                    {pos.currentPrice?.toFixed(5)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="text-red-500/80">SL: {pos.stopLoss?.toFixed(5) || 'NONE'}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-green-500/80">TP: {pos.takeProfit?.toFixed(5) || 'NONE'}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${pos.floatingPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.floatingPL >= 0 ? '+' : ''}${pos.floatingPL?.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-bold ${pos.riskPercent > 1 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {pos.riskPercent?.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {hours}h {mins}m
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="View Instrument"><Target className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Manage Protection"><Shield className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors" title="View Details"><ExternalLink className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
