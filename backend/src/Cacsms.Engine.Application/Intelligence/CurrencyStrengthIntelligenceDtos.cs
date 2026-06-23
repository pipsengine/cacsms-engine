namespace Cacsms.Engine.Application.Intelligence;

public sealed record CurrencyStrengthSnapshotDto(
    string Engine,
    string Source,
    DateTimeOffset UpdatedAt,
    string Strongest,
    string Weakest,
    string BestOpportunity,
    string TradeBias,
    decimal Confidence,
    decimal StrengthDifferential,
    decimal Divergence,
    string HtfAlignment,
    string SignalQuality,
    string XauUsdFilter,
    string RejectionReasons,
    string FocusSymbol,
    IReadOnlyList<string> Timeframes,
    IReadOnlyDictionary<string, decimal> Currencies,
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, decimal>> TimeframeMatrix);

public sealed record CurrencyStrengthIngestRequest(
    string Engine = "CacsmsCurrencyStrengthEngine",
    string? UpdatedAt = null,
    string Strongest = "",
    string Weakest = "",
    string BestOpportunity = "",
    string TradeBias = "NO TRADE",
    decimal Confidence = 0,
    decimal StrengthDifferential = 0,
    decimal Divergence = 0,
    string HtfAlignment = "MISALIGNED",
    string SignalQuality = "REJECT",
    string XauUsdFilter = "N/A",
    string RejectionReasons = "",
    string FocusSymbol = "EURUSD",
    Dictionary<string, decimal>? Currencies = null,
    Dictionary<string, Dictionary<string, decimal>>? TimeframeMatrix = null);

public sealed record CurrencyStrengthEnrichmentResult(
    decimal CurrencyStrengthScore,
    string TradeBias,
    decimal Confidence,
    string Strongest,
    string Weakest,
    string HtfAlignment,
    string SignalQuality,
    IReadOnlyCollection<string> Evidence,
    IReadOnlyCollection<string> RejectionReasons);
