export const WIZARD_CATEGORIES = Object.freeze([
  {
    id: "mt5_terminal",
    title: "MT5 Terminal",
    description: "Connect a MetaTrader 5 terminal installed on a local or remote machine.",
    examples: ["IC Markets MT5", "Exness MT5", "Pepperstone MT5"],
    providerType: "MT5",
    connectionMethod: "MT5 Bridge"
  },
  {
    id: "broker_feed",
    title: "Broker Feed",
    description: "Connect directly to a broker API or institutional liquidity feed.",
    examples: ["IC Markets API", "OANDA API", "FXCM API"],
    providerType: "Broker Feed",
    connectionMethod: "REST API"
  },
  {
    id: "external_vendor",
    title: "External Market Data Vendor",
    description: "Connect to a third-party market data provider.",
    examples: ["TwelveData", "Finnhub", "Polygon", "AlphaVantage", "TradingView"],
    providerType: null,
    connectionMethod: "REST API"
  },
  {
    id: "custom_provider",
    title: "Custom Provider",
    description: "Manually configure a custom source. Intended for advanced users.",
    examples: ["Internal Bridge", "Proprietary Feed"],
    providerType: "Custom Feed",
    connectionMethod: "Hybrid"
  }
]);

export const WIZARD_PROVIDERS = Object.freeze({
  mt5_terminal: [
    { id: "ic-markets", name: "IC Markets", brokerName: "IC Markets", brokerSearchName: "Raw Trading Ltd" },
    { id: "exness", name: "Exness", brokerName: "Exness", brokerSearchName: "Exness" },
    { id: "pepperstone", name: "Pepperstone", brokerName: "Pepperstone", brokerSearchName: "Pepperstone" },
    { id: "fp-markets", name: "FP Markets", brokerName: "FP Markets", brokerSearchName: "FP Markets" },
    { id: "eightcap", name: "Eightcap", brokerName: "Eightcap", brokerSearchName: "Eightcap" },
    { id: "custom-mt5", name: "Custom MT5", brokerName: "Custom Broker", brokerSearchName: "", custom: true }
  ],
  broker_feed: [
    { id: "ic-markets-api", name: "IC Markets", vendorKey: "ICMarkets" },
    { id: "oanda", name: "OANDA", vendorKey: "OANDA" },
    { id: "fxcm", name: "FXCM", vendorKey: "FXCM" },
    { id: "interactive-brokers", name: "Interactive Brokers", vendorKey: "InteractiveBrokers" },
    { id: "custom-broker", name: "Custom Broker", custom: true }
  ],
  external_vendor: [
    { id: "twelvedata", name: "TwelveData", vendorKey: "TwelveData" },
    { id: "finnhub", name: "Finnhub", vendorKey: "Finnhub" },
    { id: "polygon", name: "Polygon", vendorKey: "Polygon" },
    { id: "alphavantage", name: "AlphaVantage", vendorKey: "AlphaVantage" },
    { id: "tradingview", name: "TradingView", vendorKey: "TradingView" },
    { id: "custom-vendor", name: "Custom Vendor", custom: true }
  ]
});

export const VENDOR_PRESETS = Object.freeze({
  TwelveData: {
    providerType: "TwelveData",
    connectionMethod: "REST API",
    baseUrl: "https://api.twelvedata.com",
    authType: "API Key",
    vaultSecretRef: "MARKETDATA_TWELVEDATA_API_KEY",
    assetCoverage: ["Forex", "Indices", "Metals", "Commodities", "Crypto"],
    supportedSymbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30"],
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: false, spreadData: false,
      volumeData: true, depthOfMarket: false, newsData: false, sentimentData: false,
      economicData: true, cotData: false
    }
  },
  Finnhub: {
    providerType: "Finnhub",
    connectionMethod: "REST API",
    baseUrl: "https://finnhub.io/api/v1",
    authType: "API Key",
    vaultSecretRef: "MARKETDATA_FINNHUB_API_KEY",
    assetCoverage: ["Forex", "Equities", "Crypto", "Indices"],
    supportedSymbols: ["EURUSD", "GBPUSD", "AAPL", "BTCUSD"],
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: false, spreadData: false,
      volumeData: true, depthOfMarket: false, newsData: true, sentimentData: true,
      economicData: true, cotData: false
    }
  },
  Polygon: {
    providerType: "Polygon",
    connectionMethod: "REST API",
    baseUrl: "https://api.polygon.io",
    authType: "API Key",
    vaultSecretRef: "MARKETDATA_POLYGON_API_KEY",
    assetCoverage: ["Equities", "Indices", "Crypto", "Forex"],
    supportedSymbols: ["EURUSD", "SPX500", "NAS100", "BTCUSD"],
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: true, spreadData: false,
      volumeData: true, depthOfMarket: false, newsData: false, sentimentData: false,
      economicData: false, cotData: false
    }
  },
  AlphaVantage: {
    providerType: "AlphaVantage",
    connectionMethod: "REST API",
    baseUrl: "https://www.alphavantage.co",
    authType: "API Key",
    vaultSecretRef: "MARKETDATA_ALPHAVANTAGE_API_KEY",
    assetCoverage: ["Forex", "Equities", "Commodities", "Indices"],
    supportedSymbols: ["EURUSD", "GBPUSD", "XAUUSD", "US30"],
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: false, spreadData: false,
      volumeData: true, depthOfMarket: false, newsData: false, sentimentData: false,
      economicData: true, cotData: false
    }
  },
  TradingView: {
    providerType: "TradingView",
    connectionMethod: "WebSocket",
    baseUrl: "https://symbol-search.tradingview.com",
    websocketUrl: "wss://data.tradingview.com",
    authType: "Bearer Token",
    vaultSecretRef: "MARKETDATA_TRADINGVIEW_TOKEN",
    assetCoverage: ["Forex", "Indices", "Metals", "Crypto", "Equities"],
    supportedSymbols: ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30", "BTCUSD"],
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: true, spreadData: true,
      volumeData: true, depthOfMarket: false, newsData: true, sentimentData: true,
      economicData: false, cotData: false
    }
  },
  ICMarkets: {
    providerType: "Broker Feed",
    connectionMethod: "REST API",
    baseUrl: "https://api.icmarkets.com",
    authType: "API Key",
    vaultSecretRef: "MARKETDATA_ICMARKETS_API_KEY",
    assetCoverage: ["Forex", "Metals", "Indices", "Commodities"],
    supportedSymbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30"]
  },
  OANDA: {
    providerType: "Broker Feed",
    connectionMethod: "REST API",
    baseUrl: "https://api-fxtrade.oanda.com",
    authType: "Bearer Token",
    vaultSecretRef: "MARKETDATA_OANDA_API_KEY",
    assetCoverage: ["Forex", "Metals", "Indices"],
    supportedSymbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
  },
  FXCM: {
    providerType: "Broker Feed",
    connectionMethod: "REST API",
    baseUrl: "https://api.fxcm.com",
    authType: "Bearer Token",
    vaultSecretRef: "MARKETDATA_FXCM_API_KEY",
    assetCoverage: ["Forex", "Metals", "Indices"],
    supportedSymbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
  },
  InteractiveBrokers: {
    providerType: "Broker Feed",
    connectionMethod: "REST API",
    baseUrl: "https://localhost:5000/v1/api",
    authType: "OAuth",
    vaultSecretRef: "MARKETDATA_IBKR_OAUTH",
    assetCoverage: ["Forex", "Equities", "Indices", "Bonds", "Commodities"],
    supportedSymbols: ["EURUSD", "GBPUSD", "SPX500", "US30"]
  }
});

export const MT5_DEFAULT_SYMBOLS = Object.freeze([
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "XAUUSD", "NAS100", "US30", "SPX500", "GER40", "USOIL"
]);

export const MT5_KNOWN_TERMINALS = Object.freeze([]);

export const WORKFLOW_DEPENDENCY_CARDS = Object.freeze([
  { card: "Card 1", target: "Data Sources Validation", impact: "Provider required for source validation" },
  { card: "Card 2", target: "Market Intelligence Gathering", impact: "Feeds intelligence pipeline" },
  { card: "Card 3", target: "Asset Scanner", impact: "Symbol universe scanning" },
  { card: "Card 4", target: "Asset Ranking", impact: "Ranking inputs" },
  { card: "Card 5", target: "Market Analysis", impact: "Context engine inputs" },
  { card: "Card 6", target: "Computer Vision", impact: "Chart validation feeds" },
  { card: "Card 7", target: "AI Decision", impact: "Decision confidence" },
  { card: "Card 8", target: "AI Debate", impact: "Debate evidence inputs" },
  { card: "Card 9", target: "Strategy Intelligence", impact: "Strategy signal inputs" },
  { card: "Card 10", target: "Risk Intelligence", impact: "Risk validation feeds" }
]);

export function getWizardCatalog() {
  return {
    categories: WIZARD_CATEGORIES,
    providers: WIZARD_PROVIDERS,
    assetOptions: ["Forex", "Metals", "Indices", "Commodities", "Crypto", "Equities", "Bonds"],
    workflowCards: WORKFLOW_DEPENDENCY_CARDS
  };
}

export function resolveVendorPreset(vendorKey) {
  return VENDOR_PRESETS[vendorKey] || null;
}

export function resolveMt5ProviderPreset(providerId) {
  const list = WIZARD_PROVIDERS.mt5_terminal;
  const match = list.find((item) => item.id === providerId);
  if (!match || match.custom) return null;
  return {
    brokerName: match.brokerName,
    brokerSearchName: match.brokerSearchName || "",
    assetCoverage: ["Forex", "Metals", "Indices"],
    supportedSymbols: MT5_DEFAULT_SYMBOLS,
    capabilities: {
      realTimePrices: true, historicalData: true, tickData: true, spreadData: true,
      volumeData: true, depthOfMarket: true, newsData: false, sentimentData: false,
      economicData: false, cotData: false
    }
  };
}

export function applyWizardPreset(input) {
  const category = input.wizardCategory || input.category;
  const preset = { ...input };

  if (category === "external_vendor" && input.vendorKey) {
    const vendor = resolveVendorPreset(input.vendorKey);
    if (vendor) Object.assign(preset, vendor, { name: preset.name || vendor.providerType });
  }

  if (category === "broker_feed" && input.vendorKey) {
    const vendor = resolveVendorPreset(input.vendorKey);
    if (vendor) Object.assign(preset, vendor, { name: preset.name || `${input.providerName || vendor.providerType} Feed` });
  }

  if (category === "mt5_terminal") {
    preset.providerType = "MT5";
    preset.connectionMethod = "MT5 Bridge";
    const mt5 = resolveMt5ProviderPreset(input.providerTemplateId);
    if (mt5) {
      preset.brokerName = preset.brokerName || mt5.brokerName;
      preset.brokerSearchName = preset.brokerSearchName || mt5.brokerSearchName;
      preset.assetCoverage = preset.assetCoverage?.length ? preset.assetCoverage : mt5.assetCoverage;
      preset.supportedSymbols = preset.supportedSymbols || mt5.supportedSymbols;
      preset.capabilities = preset.capabilities || mt5.capabilities;
    }
    preset.name = preset.name || `${preset.brokerName || "MT5"} ${preset.terminalName || "Terminal"}`.trim();
  }

  if (category === "custom_provider") {
    preset.providerType = preset.providerType || "Custom Feed";
  }

  return preset;
}
