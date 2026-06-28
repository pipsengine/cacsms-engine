using System.Text.Json;
using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class Mt5TelemetryService(ICurrencyStrengthIntelligenceService currencyStrengthService) : IMt5TelemetryService
{
    private static readonly string[] CurrencyCodes = ["EUR", "GBP", "USD", "JPY", "AUD", "NZD", "CAD", "CHF"];
    private readonly object _sync = new();
    private readonly Dictionary<string, decimal> _previousMidPrices = new(StringComparer.OrdinalIgnoreCase);
    private CurrencyStrengthSnapshotDto? _latestCurrencyStrength;

    public DateTimeOffset? LastHeartbeatAt { get; private set; }

    public CurrencyStrengthSnapshotDto? GetLatestCurrencyStrength()
    {
        lock (_sync)
        {
            return _latestCurrencyStrength;
        }
    }

    public CurrencyStrengthSnapshotDto IngestHeartbeat(JsonElement heartbeat)
    {
        var telemetry = ReadSymbolTelemetry(heartbeat);
        var currentMidPrices = telemetry
            .Where(item => item.MidPrice > 0)
            .ToDictionary(item => item.Symbol, item => item.MidPrice, StringComparer.OrdinalIgnoreCase);

        var rawStrength = CurrencyCodes.ToDictionary(code => code, _ => 0m, StringComparer.OrdinalIgnoreCase);
        var observationCount = CurrencyCodes.ToDictionary(code => code, _ => 0, StringComparer.OrdinalIgnoreCase);

        foreach (var item in telemetry)
        {
            if (item.Symbol.Length < 6 || item.MidPrice <= 0) continue;
            if (!_previousMidPrices.TryGetValue(item.Symbol, out var previousMidPrice) || previousMidPrice <= 0) continue;

            var baseCurrency = item.Symbol[..3];
            var quoteCurrency = item.Symbol[3..6];
            if (!rawStrength.ContainsKey(baseCurrency) || !rawStrength.ContainsKey(quoteCurrency)) continue;

            var returnPoints = previousMidPrice == 0
                ? 0
                : ((item.MidPrice - previousMidPrice) / previousMidPrice) * 10000m;

            rawStrength[baseCurrency] += returnPoints;
            rawStrength[quoteCurrency] -= returnPoints;
            observationCount[baseCurrency]++;
            observationCount[quoteCurrency]++;
        }

        foreach (var current in currentMidPrices)
        {
            _previousMidPrices[current.Key] = current.Value;
        }

        var normalized = rawStrength.ToDictionary(
            pair => pair.Key,
            pair => observationCount[pair.Key] == 0 ? 0 : Math.Clamp(pair.Value / observationCount[pair.Key], -100, 100),
            StringComparer.OrdinalIgnoreCase);

        var strongestPair = normalized.OrderByDescending(pair => pair.Value).First();
        var weakestPair = normalized.OrderBy(pair => pair.Value).First();
        var differential = strongestPair.Value - weakestPair.Value;
        var confidence = Math.Clamp(Math.Abs(differential), 0, 100);
        var hasActionableStrength = confidence >= 15 && !strongestPair.Key.Equals(weakestPair.Key, StringComparison.OrdinalIgnoreCase);
        var strongest = hasActionableStrength ? strongestPair.Key : "MIXED";
        var weakest = hasActionableStrength ? weakestPair.Key : "MIXED";
        var tradeBias = confidence < 15 ? "NO TRADE" : "BUY";

        var request = new CurrencyStrengthIngestRequest(
            Engine: "CacsmsCurrencyStrengthEngine",
            UpdatedAt: DateTimeOffset.UtcNow.ToString("O"),
            Strongest: strongest,
            Weakest: weakest,
            BestOpportunity: hasActionableStrength ? strongest + weakest : "",
            TradeBias: tradeBias,
            Confidence: confidence,
            StrengthDifferential: differential,
            Divergence: CalculateDivergence(normalized),
            HtfAlignment: confidence >= 25 ? "ALIGNED" : "MIXED",
            SignalQuality: confidence >= 50 ? "A" : confidence >= 25 ? "B" : "PENDING",
            XauUsdFilter: BuildXauFilter(normalized),
            RejectionReasons: confidence < 15 ? "Currency strength differential below institutional threshold." : "",
            FocusSymbol: hasActionableStrength ? strongest + weakest : "",
            Currencies: normalized.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase),
            TimeframeMatrix: BuildFlatTimeframeMatrix(normalized));

        var snapshot = currencyStrengthService.Ingest(request);

        lock (_sync)
        {
            LastHeartbeatAt = DateTimeOffset.UtcNow;
            _latestCurrencyStrength = snapshot;
        }

        return snapshot;
    }

    private static List<SymbolTelemetry> ReadSymbolTelemetry(JsonElement heartbeat)
    {
        var result = new List<SymbolTelemetry>();
        if (!heartbeat.TryGetProperty("symbolTelemetry", out var telemetry) || telemetry.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var item in telemetry.EnumerateArray())
        {
            var symbol = ReadString(item, "symbol").ToUpperInvariant();
            var bid = ReadDecimal(item, "bid");
            var ask = ReadDecimal(item, "ask");
            var available = ReadBool(item, "available");
            var stale = ReadBool(item, "stale");

            if (symbol.Length < 6 || !available || stale || bid <= 0 || ask <= 0 || ask < bid) continue;

            result.Add(new SymbolTelemetry(symbol, (bid + ask) / 2m));
        }

        return result;
    }

    private static Dictionary<string, Dictionary<string, decimal>> BuildFlatTimeframeMatrix(Dictionary<string, decimal> strengths)
    {
        var timeframes = new[] { "M15", "M30", "H1", "H4", "H8", "H12", "D1", "W1", "MN1", "Y1" };
        return strengths.ToDictionary(
            pair => pair.Key,
            pair => timeframes.ToDictionary(timeframe => timeframe, _ => pair.Value, StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
    }

    private static decimal CalculateDivergence(Dictionary<string, decimal> strengths)
    {
        if (strengths.Count == 0) return 0;
        var average = strengths.Values.Average();
        return Math.Round(strengths.Values.Average(value => Math.Abs(value - average)), 2);
    }

    private static string BuildXauFilter(Dictionary<string, decimal> strengths)
    {
        if (!strengths.TryGetValue("USD", out var usdStrength)) return "PENDING_DATA";
        if (usdStrength <= -15) return "USD_WEAK_XAUUSD_BUY";
        if (usdStrength >= 15) return "USD_STRONG_XAUUSD_SELL";
        return "USD_MIXED_NO_XAU_SCALP";
    }

    private static string ReadString(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;
    }

    private static decimal ReadDecimal(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var value) && value.TryGetDecimal(out var result) ? result : 0;
    }

    private static bool ReadBool(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var value)
            && (value.ValueKind is JsonValueKind.True or JsonValueKind.False)
            && value.GetBoolean();
    }

    private sealed record SymbolTelemetry(string Symbol, decimal MidPrice);
}
