export interface BrokerDataSource {
  id: string;
  brokerName: string;
  platform: "MT4" | "MT5" | "cTrader" | "TradingView" | "FIX API" | "REST API" | "CSV Upload";
  accountType: "Demo" | "Live" | "Prop Firm" | "ECN" | "STP" | "Raw Spread" | "Standard";
  serverName?: string;
  status: "Connected" | "Disconnected" | "Syncing" | "Error" | "Pending";
  instruments: string[];
  lastSync?: string;
  recordsImported: number;
  missingRecords: number;
  averageSpread: number;
  latencyMs?: number;
  qualityScore: number;
}
export interface BrokerMarketData {
  id: string;
  brokerId: string;
  brokerName: string;
  platform: string;
  instrument: string;
  timeframe: string;
  timestamp: string;
  bid?: number;
  ask?: number;
  spread?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  tickCount?: number;
  latencyMs?: number;
  source: string;
  qualityFlag: "Clean" | "Warning" | "Error" | "Missing" | "Duplicate";
}
