import React from "react";
import { Shield, Activity, Clock } from "lucide-react";

export function PortfolioHeader({ stats }: { stats: any }) {
  return (
    <header className="px-6 py-8 bg-slate-900 border-b border-slate-800">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 text-xs font-bold uppercase tracking-widest">
            <Shield className="w-4 h-4" />
            Institutional Portfolio Analytics
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Account Portfolio Intelligence Center</h1>
          <p className="text-slate-400 max-w-2xl">
            Monitor portfolio performance, account health, strategy allocation, exposure, drawdowns, and risk analytics across all connected trading accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:gap-8 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 uppercase font-semibold">Accounts Connected</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xl font-bold text-white">{stats?.connectedAccounts || 0}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-slate-700 hidden sm:block"></div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 uppercase font-semibold">Portfolio Health</span>
            <div className="text-xl font-bold text-green-500">OPTIMAL</div>
          </div>
          <div className="w-px h-10 bg-slate-700 hidden sm:block"></div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 uppercase font-semibold">Risk Status</span>
            <div className="text-xl font-bold text-blue-500">MODERATE</div>
          </div>
          <div className="w-px h-10 bg-slate-700 hidden sm:block"></div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 uppercase font-semibold">Last Sync</span>
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
