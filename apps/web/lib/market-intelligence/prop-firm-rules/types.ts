export interface PropFirmRule {
  id: string;
  firmName: string;
  accountSize: number;
  accountType: "Challenge" | "Evaluation" | "Funded" | "Instant Funding";
  phase: "Phase 1" | "Phase 2" | "Verification" | "Funded";
  profitTargetPercent?: number;
  dailyLossLimitPercent: number;
  maxDrawdownPercent: number;
  minTradingDays?: number;
  maxTradingDays?: number;
  newsTradingAllowed: boolean;
  weekendHoldingAllowed: boolean;
  eaAllowed: boolean;
  copyTradingAllowed: boolean;
  payoutSplitPercent?: number;
  payoutCycle?: string;
  consistencyRule?: string;
  leverage?: string;
  status: "Active" | "Deprecated" | "Under Review";
}
export interface PropFirmComplianceAccount {
  id: string;
  accountName: string;
  firmName: string;
  phase: string;
  balance: number;
  equity: number;
  dailyLossUsedPercent: number;
  maxDrawdownUsedPercent: number;
  profitTargetProgressPercent: number;
  minimumDaysCompleted: number;
  breachRisk: "Low" | "Medium" | "High" | "Breached";
  status: "Compliant" | "Watchlist" | "At Risk" | "Breached";
}
