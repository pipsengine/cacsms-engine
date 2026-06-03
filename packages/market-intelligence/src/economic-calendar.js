export const ECONOMIC_CALENDAR_EVENTS = Object.freeze([]);
export const ECONOMIC_RESTRICTION_WINDOWS = Object.freeze([]);
export const CURRENCY_ASSET_IMPACT = Object.freeze([]);
export const CENTRAL_BANK_WATCH = Object.freeze([]);

export function evaluateEconomicCalendar({
  sourceStatus = "NOT_CONFIGURED",
  events = ECONOMIC_CALENDAR_EVENTS,
  restrictionWindows = ECONOMIC_RESTRICTION_WINDOWS,
  criticalActive = false,
  strictPropWindow = false
} = {}) {
  const configured = sourceStatus !== "NOT_CONFIGURED";
  const blocked = criticalActive || strictPropWindow;
  const restricted = !blocked && configured && (sourceStatus !== "SYNCED" || restrictionWindows.length > 0);
  const highImpactEvents = events.filter(({ impact }) => impact === "HIGH");
  const affectedAssets = [...new Set(events.flatMap(({ affectedAssets = [] }) => {
    if (Array.isArray(affectedAssets)) return affectedAssets;
    return String(affectedAssets).split("/").map((asset) => asset.trim()).filter(Boolean);
  }))];

  return {
    source: "economic_calendar",
    status: sourceStatus,
    event_risk_mode: blocked ? "BLOCKED" : configured ? "CAUTION" : "UNAVAILABLE",
    events_today: events.length,
    high_impact_events: highImpactEvents.length,
    next_high_impact_event: highImpactEvents[0]?.event ?? null,
    countdown_minutes: null,
    affected_assets: affectedAssets,
    workflow_permission: blocked ? "BLOCKED" : configured ? (restricted ? "RESTRICTED" : "ALLOWED") : "RESTRICTED",
    risk_recommendation: configured
      ? "Use live event windows and provider risk signals."
      : "Configure a live economic calendar adapter.",
    restriction_windows: restrictionWindows,
    warnings: configured ? [] : ["No live economic calendar adapter is configured."],
    blocks: blocked ? ["Critical event or protected news window active."] : []
  };
}

export function getEconomicCalendarDashboard() {
  return {
    ...evaluateEconomicCalendar(),
    events: ECONOMIC_CALENDAR_EVENTS,
    assetImpact: CURRENCY_ASSET_IMPACT,
    centralBanks: CENTRAL_BANK_WATCH,
    eventRiskScore: null,
    calendarFreshness: "UNAVAILABLE",
    source_mode: "LIVE_ADAPTERS_ONLY"
  };
}
