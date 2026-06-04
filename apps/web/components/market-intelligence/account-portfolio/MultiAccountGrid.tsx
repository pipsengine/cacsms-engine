import React from "react";
import { ExternalLink, RefreshCw, BarChart2, Shield, Download } from "lucide-react";

export function MultiAccountGrid({ accounts }: { accounts: any[] }) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "healthy": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "watchlist": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "at risk": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getHealthGradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "text-green-400";
      case "B": return "text-blue-400";
      case "C": return "text-amber-400";
      case "D": return "text-orange-400";
      case "F": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div>
          <h2 className="text-lg font-bold text-white">Multi-Account Portfolio Grid</h2>
          <p className="text-xs text-slate-400">Consolidated real-time view of all connected trading accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 uppercase">{accounts?.length || 0} ACCOUNTS</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/50">
              <th className="px-6 py-4">Account Name</th>
              <th className="px-4 py-4">Broker / Server</th>
              <th className="px-4 py-4 text-right">Balance</th>
              <th className="px-4 py-4 text-right">Equity</th>
              <th className="px-4 py-4 text-right">Floating P/L</th>
              <th className="px-4 py-4 text-center">Drawdown</th>
              <th className="px-4 py-4 text-center">Risk</th>
              <th className="px-4 py-4 text-center">Health</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {accounts?.map((acc) => (
              <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{acc.accountName}</span>
                    <span className="text-[10px] font-mono text-slate-500">{acc.accountNumberMasked} • {acc.accountType}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-300">{acc.brokerName}</span>
                    <span className="text-[10px] text-slate-500">{acc.server}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">
                  {acc.currency} {acc.balance?.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right font-mono text-sm font-bold text-white">
                  {acc.currency} {acc.equity?.toLocaleString()}
                </td>
                <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${acc.floatingPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {acc.floatingPL >= 0 ? '+' : ''}{acc.floatingPL?.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-bold ${acc.dailyDrawdownPercent > 2 ? 'text-amber-500' : 'text-slate-300'}`}>
                      {acc.dailyDrawdownPercent?.toFixed(2)}%
                    </span>
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${acc.dailyDrawdownPercent > 5 ? 'bg-red-500' : acc.dailyDrawdownPercent > 2 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, acc.dailyDrawdownPercent * 10)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    acc.riskScore > 50 ? 'border-red-500/30 text-red-500 bg-red-500/10' : 
                    acc.riskScore > 30 ? 'border-amber-500/30 text-amber-500 bg-amber-500/10' : 
                    'border-blue-500/30 text-blue-500 bg-blue-500/10'
                  }`}>
                    {acc.riskScore?.toFixed(0)}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`text-lg font-black ${getHealthGradeColor(acc.healthGrade)}`}>
                    {acc.healthGrade || 'A'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(acc.status)}`}>
                    {acc.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Open Account"><ExternalLink className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Sync"><RefreshCw className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Analytics"><BarChart2 className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Risk View"><Shield className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Export"><Download className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
