using System.Text.Json;
using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class Mt5TelemetryService(ICurrencyStrengthIntelligenceService currencyStrengthService) : IMt5TelemetryService
{
    private static readonly string[] CurrencyCodes = ["EUR", "GBP", "USD", "JPY", "AUD", "NZD", "CAD", "CHF"];
    private static readonly string[] Timeframes = ["M15", "M30", "H1", "H4", "H8", "H12", "D1", "W1", "MN1", "Y1"];
    private static readonly IReadOnlyDictionary<string, decimal> CompositeWeights = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
    {
        ["M15"] = 0.08m,
        ["M30"] = 0.08m,
        ["H1"] = 0.10m,
        ["H4"] = 0.12m,
        ["H8"] = 0.10m,
        ["H12"] = 0.10m,
        ["D1"] = 0.16m,
        ["W1"] = 0.10m,
        ["MN1"] = 0.08m,
        ["Y1"] = 0.08m
    };

    private readonly object _sync = new();
    private readonly Dictionary<string, decimal> _previousMidPrices = new(StringComparer.OrdinalIgnoreCase);
    private CurrencyStrengthSnapshotDto? _latestCurrencyStrength;

    public DateTimeOffset? LastHeartbeatAt { get; private set; }
    public string LatestTerminalId { get; private set; } = "";
    public string LatestEaName { get; private set; } = "";
    public string LatestBridgeKind { get; private set; } = "";
    public bool LatestHeartbeatHasTimeframeTelemetry { get; private set; }

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
        var terminalId = ReadString(heartbeat, "terminalId");
        var eaName = ReadString(heartbeat, "eaName");
        var bridgeKind = ReadString(heartbeat, "bridgeKind");
        var currentMidPrices = telemetry
            .Where(item => item.MidPrice > 0)
            .ToDictionary(item => item.Symbol, item => item.MidPrice, StringComparer.OrdinalIgnoreCase);

        var rawStrength = CurrencyCodes.ToDictionary(code => code, _ => 0m, StringComparer.OrdinalIgnoreCase);
        var observationCount = CurrencyCodes.ToDictionary(code => code, _ => 0, StringComparer.OrdinalIgnoreCase);
        var timeframeStrength = CurrencyCodes.ToDictionary(
            code => code,
            _ => Timeframes.ToDictionary(timeframe => timeframe, _ => 0m, StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
        var timeframeObservationCount = CurrencyCodes.ToDictionary(
            code => code,
            _ => Timeframes.ToDictionary(timeframe => timeframe, _ => 0, StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
        var hasTimeframeTelemetry = false;

        foreach (var item in telemetry)
        {
            if (item.Symbol.Length < 6 || item.MidPrice <= 0) continue;

            var baseCurrency = item.Symbol[..3];
            var quoteCurrency = item.Symbol[3..6];
            if (!rawStrength.ContainsKey(baseCurrency) || !rawStrength.ContainsKey(quoteCurrency)) continue;

            foreach (var timeframeMove in item.TimeframeChangeBps)
            {
                if (!CompositeWeights.ContainsKey(timeframeMove.Key)) continue;

                var scaledMove = ScaleMoveToStrength(timeframeMove.Value);
                timeframeStrength[baseCurrency][timeframeMove.Key] += scaledMove;
                timeframeStrength[quoteCurrency][timeframeMove.Key] -= scaledMove;
                timeframeObservationCount[baseCurrency][timeframeMove.Key]++;
                timeframeObservationCount[quoteCurrency][timeframeMove.Key]++;
                hasTimeframeTelemetry = true;
            }

            if (hasTimeframeTelemetry) continue;
            if (!_previousMidPrices.TryGetValue(item.Symbol, out var previousMidPrice) || previousMidPrice <= 0) continue;

            var returnPoints = ((item.MidPrice - previousMidPrice) / previousMidPrice) * 10000m;

            rawStrength[baseCurrency] += returnPoints;
            rawStrength[quoteCurrency] -= returnPoints;
            observationCount[baseCurrency]++;
            observationCount[quoteCurrency]++;
        }

        foreach (var current in currentMidPrices)
        {
            _previousMidPrices[current.Key] = current.Value;
        }

        var timeframeMatrix = hasTimeframeTelemetry
            ? NormalizeTimeframeMatrix(timeframeStrength, timeframeObservationCount)
            : BuildFlatTimeframeMatrix(rawStrength.ToDictionary(
                pair => pair.Key,
                pair => observationCount[pair.Key] == 0 ? 0 : Math.Clamp(pair.Value / observationCount[pair.Key], -100, 100),
                StringComparer.OrdinalIgnoreCase));

        var normalized = BuildCompositeStrength(timeframeMatrix);

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
            TimeframeMatrix: timeframeMatrix);

        var snapshot = currencyStrengthService.Ingest(request);

        lock (_sync)
        {
            LastHeartbeatAt = DateTimeOffset.UtcNow;
            LatestTerminalId = terminalId;
            LatestEaName = string.IsNullOrWhiteSpace(eaName) ? "Legacy/Unknown EA" : eaName;
            LatestBridgeKind = string.IsNullOrWhiteSpace(bridgeKind) ? "legacy" : bridgeKind;
            LatestHeartbeatHasTimeframeTelemetry = hasTimeframeTelemetry;
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

            if (symbol.Length < 6 || !available || bid <= 0 || ask <= 0 || ask < bid) continue;

            result.Add(new SymbolTelemetry(symbol, (bid + ask) / 2m, ReadTimeframeChangeBps(item)));
        }

        return result;
    }

    private static Dictionary<string, decimal> BuildCompositeStrength(Dictionary<string, Dictionary<string, decimal>> timeframeMatrix)
    {
        return timeframeMatrix.ToDictionary(
            pair => pair.Key,
            pair => Math.Round(pair.Value.Sum(timeframe => timeframe.Value * CompositeWeights.GetValueOrDefault(timeframe.Key, 0m)), 2),
            StringComparer.OrdinalIgnoreCase);
    }

    private static Dictionary<string, Dictionary<string, decimal>> NormalizeTimeframeMatrix(
        Dictionary<string, Dictionary<string, decimal>> rawTimeframeStrength,
        Dictionary<string, Dictionary<string, int>> observationCounts)
    {
        return rawTimeframeStrength.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.ToDictionary(
                timeframe => timeframe.Key,
                timeframe => observationCounts[pair.Key][timeframe.Key] == 0
                    ? 0
                    : Math.Clamp(Math.Round(timeframe.Value / observationCounts[pair.Key][timeframe.Key], 2), -100, 100),
                StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
    }

    private static Dictionary<string, Dictionary<string, decimal>> BuildFlatTimeframeMatrix(Dictionary<string, decimal> strengths)
    {
        return strengths.ToDictionary(
            pair => pair.Key,
            pair => Timeframes.ToDictionary(timeframe => timeframe, _ => pair.Value, StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
    }

    private static decimal ScaleMoveToStrength(decimal moveBps)
    {
        return Math.Clamp(Math.Round(moveBps, 2), -100, 100);
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

    private static Dictionary<string, decimal> ReadTimeframeChangeBps(JsonElement element)
    {
        var result = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        if (!element.TryGetProperty("timeframeChangeBps", out var changes) || changes.ValueKind != JsonValueKind.Object)
        {
            return result;
        }

        foreach (var timeframe in Timeframes)
        {
            if (changes.TryGetProperty(timeframe, out var value) && value.TryGetDecimal(out var parsed))
            {
                result[timeframe] = parsed;
            }
        }

        return result;
    }

    private sealed record SymbolTelemetry(string Symbol, decimal MidPrice, IReadOnlyDictionary<string, decimal> TimeframeChangeBps);
}
