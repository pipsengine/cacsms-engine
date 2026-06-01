export const COT_SOURCE_URL = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm";
export const COT_REPORT_TYPE = "FUTURES_ONLY";
export const COT_SYNC_CRON = "0 0 * * 6";
export const COT_CURRENCY_MAPPINGS = Object.freeze([
  ["AUD", "Australian Dollar", "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE"],
  ["CAD", "Canadian Dollar", "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE"],
  ["CHF", "Swiss Franc", "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE"],
  ["EUR", "Euro FX", "EURO FX - CHICAGO MERCANTILE EXCHANGE"],
  ["GBP", "British Pound", "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE"],
  ["JPY", "Japanese Yen", "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE"],
  ["NZD", "New Zealand Dollar", "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE"],
  ["USD", "U.S. Dollar Index", "U.S. DOLLAR INDEX - ICE FUTURES U.S."],
  ["XAU", "Gold", "GOLD - COMMODITY EXCHANGE INC."],
].map(([currency_code, currency_name, contract_market_name]) => ({ currency_code, currency_name, contract_market_name, report_type: COT_REPORT_TYPE, enabled: true })));
export const COT_WORKFLOW_IMPACTS = Object.freeze([
  ["Stage 1", "Market Intelligence", "Institutional market context"],
  ["Stage 3", "Asset Ranking", "Improves relative currency ranking"],
  ["Stage 4", "Market Analysis", "Validates directional bias"],
  ["Stage 6", "AI Decision", "Modifies decision confidence"],
  ["Stage 7", "AI Debate", "Adds positioning evidence"],
  ["Stage 8", "Strategy Intelligence", "Guides strategy suitability"],
  ["Stage 9", "Risk Validation", "Identifies crowded-position risk"],
].map(([stage, target, usage]) => ({ stage, target, usage })));

export function createCotSyncStatus(payload) {
  const records = Object.values(payload.history).reduce((sum, rows) => sum + rows.length, 0);
  return { job: "cot_weekly_sync_job", status: "SYNCED", cron: COT_SYNC_CRON, frequency: "Weekly", day: "Saturday", time: "12:00am", last_sync_at: payload.syncedAt, latest_report_date: payload.latestReportDate, records_imported: records, records_updated: 0, duplicates_skipped: 0, failed_records: 0, retries: 3 };
}

export function getCotComparison(payload) {
  return payload.mappings.map(mapping => {
    const row = payload.history[mapping.code]?.[0];
    return { currency_code: mapping.code, currency_name: mapping.name, contract_market_name: mapping.market, records_available: payload.history[mapping.code]?.length || 0, latest_report_date: row?.date || null, long: row?.long || 0, short: row?.short || 0, net_positions: row?.net || 0, weekly_change: row ? row.changeLong - row.changeShort : 0, bias: row?.bias || "UNAVAILABLE", bias_confidence: row?.confidence || 0, workflow_impact: row ? "Context modifier" : "Mapping requires source review" };
  });
}

export function evaluateInstitutionalCot(payload, { currency = "EUR", syncStatus = "SYNCED", staleCycles = 0 } = {}) {
  const selected = payload.history[currency]?.[0], restricted = !selected || syncStatus === "FAILED" && staleCycles > 1;
  return { source: "institutional_cot_data", report_type: COT_REPORT_TYPE, sync_status: syncStatus, latest_report_date: selected?.date || null, selected_currency: currency, bias: selected?.bias?.toUpperCase() || "UNKNOWN", long: selected?.long || 0, short: selected?.short || 0, change_long: selected?.changeLong || 0, change_short: selected?.changeShort || 0, percent_change: selected?.percent || 0, net_positions: selected?.net || 0, bias_confidence: selected?.confidence || 0, workflow_permission: restricted ? "RESTRICTED" : syncStatus === "SYNCED" ? "ALLOWED" : "ALLOWED_WITH_WARNING", warnings: ["COT is weekly and lagging; use only as institutional context"], blocks: [] };
}

export function getInstitutionalCotDashboard(payload, currency = "EUR") {
  const sync = createCotSyncStatus(payload);
  return { ...evaluateInstitutionalCot(payload, { currency }), sync, currencies: getCotComparison(payload), history: payload.history[currency] || [], comparison: getCotComparison(payload), syncLogs: [{ sync_id: `cot-${payload.year}-${payload.latestReportDate}`, completed_at: payload.syncedAt, status: "SYNCED", source_url: payload.sourceUrl, report_type: COT_REPORT_TYPE, year: payload.year, records_imported: sync.records_imported }], workflowImpacts: COT_WORKFLOW_IMPACTS };
}
