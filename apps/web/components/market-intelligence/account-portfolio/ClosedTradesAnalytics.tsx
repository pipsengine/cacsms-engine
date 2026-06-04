import React from "react";
import { History, Download, TrendingUp, TrendingDown, Target } from "lucide-react";

export function ClosedTradesAnalytics({ trades }: { trades: any[] }) {
  const stats = [
    { label: "Total Trades", value: trades?.length || 0, icon: <History className="w-4 h-4 text-blue-500" /> },
    { label: "Win Rate", value: "68.4%", icon: <Target className="w-4 h-4 text-green-500" /> },
    { label: "Avg. Win", value: "+$412.40", icon: <TrendingUp className="w-4 h-4 text-green-400" /> },
    { label: "Avg. Loss", value: "-$182.10", icon: <TrendingDown className="w-4 h-4 text-red-400" /> },
  ];

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Closed Trades Analytics</h2>
            <p className="text-xs text-slate-400">Historical performance and strategy attribution</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-2">
            <Download className="w-3.5 h-3.5" />
            Export History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-950/30">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">{stat.icon}</div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</span>
              <span className="text-lg font-bold text-white">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="overflow-x-auto border-t border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/50">
              <th className="px-6 py-4">Account</th>
              <th className="px-4 py-4">Instrument</th>
              <th className="px-4 py-4 text-center">Type</th>
              <th className="px-4 py-4 text-right">Size</th>
              <th className="px-4 py-4 text-right">Entry / Exit</th>
              <th className="px-4 py-4 text-right">Profit/Loss</th>
              <th className="px-4 py-4 text-center">R-Multiple</th>
              <th className="px-4 py-4 text-center">Duration</th>
              <th className="px-4 py-4">Strategy</th>
              <th className="px-4 py-4">Reason</th>
              <th className="px-6 py-4 text-right">Closed At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {trades?.map((trade, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-400">{trade[0]}</span>
                </td>
                <td className="px-4 py-4 font-bold text-white uppercase tracking-tight text-sm">
                  {trade[2]}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    trade[3] === 'Buy' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {trade[3]}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">
                  {trade[4]}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-300 font-mono">{trade[5]}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{trade[6]}</span>
                  </div>
                </td>
                <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${trade[7].startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {trade[7]}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    parseFloat(trade[8]) >= 1 ? 'text-green-400 bg-green-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {trade[8]}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-xs text-slate-500">
                  {trade[11]}
                </td>
                <td className="px-4 py-4">
                  <span className="text-xs text-blue-400 font-medium">{trade[12]}</span>
                </td>
                <td className="px-4 py-4 text-xs text-slate-500 italic">
                  {trade[13]}
                </td>
                <td className="px-6 py-4 text-right text-[10px] font-mono text-slate-500 uppercase">
                  {trade[14]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
