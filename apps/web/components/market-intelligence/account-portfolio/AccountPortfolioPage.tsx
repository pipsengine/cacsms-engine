"use client";

import React, { useState, useEffect } from "react";
import { 
  RefreshCw, Plus, Download, FileText, Shield, 
  Activity, BarChart3, PieChart, AlertTriangle, Briefcase,
  History, Target, Brain, FileDown
} from "lucide-react";
import { PortfolioHeader } from "./PortfolioHeader";
import { ExecutiveKpiCards } from "./ExecutiveKpiCards";
import { MultiAccountGrid } from "./MultiAccountGrid";
import { EquityGrowthAnalytics } from "./EquityGrowthAnalytics";
import { AllocationEngine } from "./AllocationEngine";
import { RiskManagementCenter } from "./RiskManagementCenter";
import { OpenPositionsDashboard } from "./OpenPositionsDashboard";
import { ClosedTradesAnalytics } from "./ClosedTradesAnalytics";
import { StrategyPerformanceCenter } from "./StrategyPerformanceCenter";
import { CorrelationIntelligence } from "./CorrelationIntelligence";
import { PropComplianceIntegration } from "./PropComplianceIntegration";
import { AiAdvisorPanel } from "./AiAdvisorPanel";
import { DrawdownIntelligence } from "./DrawdownIntelligence";

export function AccountPortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8080/api/portfolio/dashboard")
      .then(res => res.json())
      .then(data => {
        setPortfolioData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch portfolio data:", err);
        setLoading(false);
      });
  }, []);

  const tabs = [
    { id: "overview", label: "Overview", icon: <Activity className="w-4 h-4" /> },
    { id: "accounts", label: "Accounts", icon: <Briefcase className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "positions", label: "Open Positions", icon: <Activity className="w-4 h-4" /> },
    { id: "trades", label: "Closed Trades", icon: <History className="w-4 h-4" /> },
    { id: "risk", label: "Risk Center", icon: <Shield className="w-4 h-4" /> },
    { id: "strategies", label: "Strategies", icon: <Target className="w-4 h-4" /> },
    { id: "correlations", label: "Correlations", icon: <PieChart className="w-4 h-4" /> },
    { id: "compliance", label: "Prop Compliance", icon: <Shield className="w-4 h-4" /> },
    { id: "reports", label: "Reports", icon: <FileText className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
          <h2 className="text-xl font-semibold">Loading Portfolio Intelligence...</h2>
          <p className="text-slate-400">Aggregating account data across connected brokers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <PortfolioHeader stats={portfolioData?.summary} />

      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors border border-slate-700">
              <RefreshCw className="w-4 h-4" />
              Sync
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-lg shadow-blue-900/20">
              <Plus className="w-4 h-4" />
              Connect
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 p-6 space-y-6">
        {activeTab === "overview" && (
          <>
            <ExecutiveKpiCards summary={portfolioData?.summary} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <EquityGrowthAnalytics data={portfolioData?.equityCurve} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DrawdownIntelligence data={portfolioData?.risk} />
                  <RiskManagementCenter data={portfolioData?.risk} />
                </div>
              </div>
              <div className="space-y-6">
                <AiAdvisorPanel insights={portfolioData?.aiInsights} />
                <AllocationEngine allocations={portfolioData?.allocations} />
              </div>
            </div>
          </>
        )}

        {activeTab === "accounts" && (
          <div className="space-y-6">
            <MultiAccountGrid accounts={portfolioData?.accounts} />
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllocationEngine />
            <DrawdownIntelligence data={portfolioData?.risk} />
            <EquityGrowthAnalytics data={portfolioData?.equityCurve} />
            <CorrelationIntelligence correlations={portfolioData?.correlations} />
          </div>
        )}

        {activeTab === "positions" && (
          <OpenPositionsDashboard positions={portfolioData?.openPositions} />
        )}

        {activeTab === "trades" && (
          <ClosedTradesAnalytics trades={portfolioData?.closedTrades} />
        )}

        {activeTab === "risk" && (
          <div className="space-y-6">
            <RiskManagementCenter data={portfolioData?.risk} fullWidth />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CorrelationIntelligence correlations={portfolioData?.correlations} />
              <DrawdownIntelligence data={portfolioData?.risk} />
            </div>
          </div>
        )}

        {activeTab === "strategies" && (
          <StrategyPerformanceCenter strategies={portfolioData?.strategies} />
        )}

        {activeTab === "correlations" && (
          <CorrelationIntelligence fullWidth />
        )}

        {activeTab === "compliance" && (
          <PropComplianceIntegration accounts={portfolioData?.accounts} />
        )}

        {activeTab === "reports" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {["Daily Performance", "Weekly Risk Summary", "Monthly Strategy Review", "Audit Logs", "Compliance Report", "Executive Summary"].map(report => (
              <div key={report} className="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-blue-500/50 transition-colors group cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 bg-slate-800 rounded-md hover:text-blue-400" title="Download PDF"><FileDown className="w-4 h-4" /></button>
                    <button className="p-1.5 bg-slate-800 rounded-md hover:text-green-400" title="Download Excel"><Download className="w-4 h-4" /></button>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-1">{report}</h3>
                <p className="text-sm text-slate-400 mb-4">Last generated: June 4, 2026</p>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider">
                  <span>PDF</span> • <span>XLSX</span> • <span>CSV</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {portfolioData && !portfolioData?.accounts?.length && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl max-w-2xl w-full text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
              <Briefcase className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">No Trading Accounts Connected</h2>
              <p className="text-slate-400 text-lg">
                Connect your first MT5 account or import a trade history statement to unlock institutional portfolio analytics.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <a href="/workspace/market-intelligence/market-data" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors text-center space-y-2">
                <Activity className="w-6 h-6 mx-auto text-blue-400" />
                <span className="block text-sm font-medium">Connect MT5</span>
              </a>
              <button type="button" onClick={() => fetch("http://localhost:8080/api/portfolio/sync", { method: "POST" }).then(() => location.reload())} className="p-4 bg-blue-600 border border-blue-500 rounded-xl hover:bg-blue-500 transition-colors text-center space-y-2 shadow-lg shadow-blue-900/40">
                <RefreshCw className="w-6 h-6 mx-auto text-white" />
                <span className="block text-sm font-medium">Sync Live Accounts</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
