export type DataQualityGateStatus = "PASSED" | "WARNING" | "BLOCKED";
export type DataQualitySourceStatus = "ONLINE" | "LIVE" | "SYNCED" | "SCHEDULED" | "OPTIONAL" | "STALE" | "FAILED";

export interface DataQualitySourceSnapshot {
  id: string;
  name: string;
  provider: string;
  required: boolean;
  status: DataQualitySourceStatus;
  healthScore: number;
  freshnessSeconds: number;
  latencyMs: number;
  errorCount: number;
  failureAction: string;
}

export interface DataQualityGateRule {
  id: string;
  name: string;
  severity: "Critical" | "High" | "Medium" | "Advisory";
  sourceId: string;
  description: string;
  status: "PASSED" | "WARNING" | "FAILED";
}

export interface DataQualityGateDashboard {
  gateStatus: DataQualityGateStatus;
  workflowPermission: "ALLOWED" | "RESTRICTED";
  dataQualityScore: number;
  proceedToStageOne: boolean;
  tradingMode: "NORMAL" | "RESTRICTED";
  sources: DataQualitySourceSnapshot[];
  rules: DataQualityGateRule[];
  warnings: string[];
  rejectReasons: string[];
}
