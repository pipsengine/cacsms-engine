import { z } from "zod";

export const providerCapabilitiesSchema = z.object({
  realTimePrices: z.boolean().default(true),
  historicalData: z.boolean().default(false),
  tickData: z.boolean().default(false),
  spreadData: z.boolean().default(false),
  volumeData: z.boolean().default(false),
  depthOfMarket: z.boolean().default(false),
  newsData: z.boolean().default(false),
  sentimentData: z.boolean().default(false),
  economicData: z.boolean().default(false),
  cotData: z.boolean().default(false)
});

export const addProviderSchema = z.object({
  name: z.string().trim().min(1, "Provider name is required"),
  providerType: z.enum([
    "MT5", "Broker Feed", "TwelveData", "Polygon", "Finnhub",
    "AlphaVantage", "TradingView", "DXFeed", "Bloomberg", "Refinitiv", "Custom Feed"
  ]),
  description: z.string().optional().default(""),
  vendorWebsite: z.string().optional().default(""),
  contactInfo: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  connectionMethod: z.enum([
    "REST API", "WebSocket", "MT5 Bridge", "FIX", "Database", "Manual Upload", "Hybrid"
  ]),
  baseUrl: z.string().optional().default(""),
  websocketUrl: z.string().optional().default(""),
  port: z.string().optional().default(""),
  environment: z.enum(["Development", "Testing", "Staging", "Production"]),
  enabled: z.boolean().default(true),
  authType: z.enum(["None", "API Key", "Bearer Token", "OAuth", "Vault Secret"]).default("None"),
  vaultSecretRef: z.string().optional().default(""),
  capabilities: providerCapabilitiesSchema,
  assetCoverage: z.array(z.string()).default(["Forex"]),
  supportedSymbols: z.string().optional().default("")
}).superRefine((values, ctx) => {
  if (values.connectionMethod === "REST API" && !values.baseUrl.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Base URL is required for REST API", path: ["baseUrl"] });
  }
  if (values.connectionMethod === "WebSocket" && !values.websocketUrl.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WebSocket URL is required", path: ["websocketUrl"] });
  }
  if (values.connectionMethod === "Hybrid" && !values.baseUrl.trim() && !values.websocketUrl.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide Base URL or WebSocket URL", path: ["baseUrl"] });
  }
  if (values.authType !== "None" && !values.vaultSecretRef.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vault secret reference is required", path: ["vaultSecretRef"] });
  }
});

export type AddProviderFormValues = z.infer<typeof addProviderSchema>;

export const defaultAddProviderValues: AddProviderFormValues = {
  name: "",
  providerType: "MT5",
  description: "",
  vendorWebsite: "",
  contactInfo: "",
  notes: "",
  connectionMethod: "MT5 Bridge",
  baseUrl: "",
  websocketUrl: "",
  port: "",
  environment: "Production",
  enabled: true,
  authType: "None",
  vaultSecretRef: "",
  capabilities: {
    realTimePrices: true,
    historicalData: false,
    tickData: true,
    spreadData: true,
    volumeData: false,
    depthOfMarket: false,
    newsData: false,
    sentimentData: false,
    economicData: false,
    cotData: false
  },
  assetCoverage: ["Forex"],
  supportedSymbols: ""
};

export type ProviderTestResult = {
  status: "SUCCESS" | "FAILED";
  latency_ms: number;
  provider_health: number;
  symbols_found: number;
  message: string;
};

export type ProviderCreateResponse = {
  accepted: boolean;
  provider: Record<string, unknown>;
  testResult?: ProviderTestResult | null;
  notification: {
    title: string;
    providerName: string;
    providerCode?: string;
    status: string;
    workflowImpact: string;
  };
  dashboard?: Record<string, unknown>;
};

export type CoveragePreview = {
  assetCoverage: string[];
  symbols: string[];
  estimatedCoverage: number;
  coveragePct: number;
};
