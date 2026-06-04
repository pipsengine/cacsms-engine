import React from "react";
import { Shield, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export function RiskManagementCenter({ data, fullWidth = false }: { data: any[], fullWidth?: boolean }) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "healthy": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "watchlist": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "at risk": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "healthy": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "watchlist": return <Info className="w-4 h-4 text-amber-500" />;
      case "at risk": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "critical": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl ${fullWidth ? 'w-full' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">Portfolio Risk Center</h3>
            <p className="text-xs text-slate-400">Real-time risk metrics and guardrail monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-[10px] font-bold uppercase tracking-widest">
            All Rules Passing
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {data?.map((metric, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              {getStatusIcon(metric[3])}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{metric[0]}</span>
                <span className="text-[10px] text-slate-500">Limit: {metric[2]}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold ${metric[3].toLowerCase() === 'healthy' ? 'text-slate-200' : 'text-amber-500'}`}>
                {metric[1]}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tighter w-20 text-center ${getStatusColor(metric[3])}`}>
                {metric[3]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Portfolio VaR (95%)</span>
          <div className="text-lg font-bold text-slate-200">$4,824.50</div>
          <p className="text-[9px] text-slate-500 italic">Expected daily max loss</p>
        </div>
        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Leverage Usage</span>
          <div className="text-lg font-bold text-blue-400">1:12.4</div>
          <p className="text-[9px] text-slate-500 italic">Effective portfolio leverage</p>
        </div>
      </div>
    </div>
  );
}
