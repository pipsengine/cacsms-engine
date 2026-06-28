using System.Globalization;
using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class CurrencyStrengthIntelligenceService : ICurrencyStrengthIntelligenceService
{
    private static readonly string[] Timeframes =
    [
        "M15", "M30", "H1", "H4", "H8", "H12", "D1", "W1", "MN1", "Y1"
    ];

    private static readonly string[] Currencies =
    [
        "EUR", "GBP", "USD", "JPY", "AUD", "NZD", "CAD", "CHF"
    ];

    private readonly object _sync = new();
    private CurrencyStrengthSnapshotDto _latest;

    public CurrencyStrengthIntelligenceService()
    {
        _latest = CreateUnavailableSnapshot();
    }

    public CurrencyStrengthSnapshotDto GetLatest()
    {
        lock (_sync)
        {
            return _latest;
        }
    }

    public CurrencyStrengthSnapshotDto Ingest(CurrencyStrengthIngestRequest request)
    {
        var updatedAt = ParseUpdatedAt(request.UpdatedAt);
        var currencies = request.Currencies is { Count: > 0 }
            ? request.Currencies
            : new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        var matrix = NormalizeMatrix(request.TimeframeMatrix, currencies);
        var strongest = string.IsNullOrWhiteSpace(request.Strongest)
            ? ResolveStrongest(currencies)
            : request.Strongest.Trim().ToUpperInvariant();
        var weakest = string.IsNullOrWhiteSpace(request.Weakest)
            ? ResolveWeakest(currencies)
            : request.Weakest.Trim().ToUpperInvariant();
        var confidence = Math.Clamp(request.Confidence, 0, 100);
        var hasActionableOpportunity = confidence >= 15
            && !string.IsNullOrWhiteSpace(strongest)
            && !string.IsNullOrWhiteSpace(weakest)
            && !strongest.Equals("MIXED", StringComparison.OrdinalIgnoreCase)
            && !weakest.Equals("MIXED", StringComparison.OrdinalIgnoreCase)
            && !strongest.Equals(weakest, StringComparison.OrdinalIgnoreCase);
        var bestOpportunity = string.IsNullOrWhiteSpace(request.BestOpportunity)
            ? hasActionableOpportunity ? strongest + weakest : string.Empty
            : request.BestOpportunity.Trim().ToUpperInvariant();

        var snapshot = new CurrencyStrengthSnapshotDto(
            string.IsNullOrWhiteSpace(request.Engine) ? "CacsmsCurrencyStrengthEngine" : request.Engine.Trim(),
            "mt5",
            updatedAt,
            strongest,
            weakest,
            bestOpportunity,
            NormalizeBias(request.TradeBias),
            confidence,
            request.StrengthDifferential,
            request.Divergence,
            request.HtfAlignment.Trim().ToUpperInvariant(),
            request.SignalQuality.Trim().ToUpperInvariant(),
            request.XauUsdFilter,
            request.RejectionReasons,
            request.FocusSymbol.Trim().ToUpperInvariant(),
            Timeframes,
            currencies,
            matrix);

        lock (_sync)
        {
            _latest = snapshot;
        }

        return snapshot;
    }

    public CurrencyStrengthEnrichmentResult EnrichForSymbol(string symbol)
    {
        CurrencyStrengthSnapshotDto snapshot;
        lock (_sync)
        {
            snapshot = _latest;
        }

        var normalizedSymbol = symbol.Trim().ToUpperInvariant();
        var evidence = new List<string>
        {
            $"Currency strength source: {snapshot.Source.ToUpperInvariant()}."
        };
        var rejections = SplitReasons(snapshot.RejectionReasons);

        var baseCurrency = normalizedSymbol.Length >= 6 ? normalizedSymbol[..3] : string.Empty;
        var quoteCurrency = normalizedSymbol.Length >= 6 ? normalizedSymbol[3..6] : string.Empty;

        decimal baseStrength = 50;
        decimal quoteStrength = 50;

        if (!string.IsNullOrWhiteSpace(baseCurrency) && snapshot.Currencies.TryGetValue(baseCurrency, out var baseScore))
        {
            baseStrength = NormalizeCurrencyScore(baseScore);
            evidence.Add($"Base currency {baseCurrency} normalized strength {baseScore:0.0} (gate score {baseStrength:0}).");
        }

        if (!string.IsNullOrWhiteSpace(quoteCurrency) && snapshot.Currencies.TryGetValue(quoteCurrency, out var quoteScore))
        {
            quoteStrength = NormalizeCurrencyScore(quoteScore);
            evidence.Add($"Quote currency {quoteCurrency} normalized strength {quoteScore:0.0} (gate score {quoteStrength:0}).");
        }

        decimal currencyStrengthScore;
        if (normalizedSymbol.Equals("XAUUSD", StringComparison.OrdinalIgnoreCase)
            && snapshot.Currencies.TryGetValue("USD", out var usdScore))
        {
            currencyStrengthScore = NormalizeCurrencyScore(-usdScore);
            evidence.Add("XAUUSD uses inverted USD strength as the primary macro filter.");
        }
        else
        {
            currencyStrengthScore = Math.Clamp(50 + ((baseStrength - quoteStrength) / 2), 0, 100);
            evidence.Add($"Strongest currency {snapshot.Strongest}; weakest currency {snapshot.Weakest}.");
        }

        if (snapshot.HtfAlignment.Equals("ALIGNED", StringComparison.OrdinalIgnoreCase))
        {
            evidence.Add("Higher-timeframe currency strength alignment is confirmed.");
        }
        else
        {
            rejections.Add("Currency strength HTF alignment is missing.");
        }

        if (snapshot.Confidence < 55)
        {
            rejections.Add("Currency strength confidence is below 55%.");
        }

        if (snapshot.TradeBias.Equals("NO TRADE", StringComparison.OrdinalIgnoreCase))
        {
            rejections.Add("Currency strength engine returned NO TRADE bias.");
        }

        return new CurrencyStrengthEnrichmentResult(
            currencyStrengthScore,
            snapshot.TradeBias,
            snapshot.Confidence,
            snapshot.Strongest,
            snapshot.Weakest,
            snapshot.HtfAlignment,
            snapshot.SignalQuality,
            evidence,
            rejections.Distinct(StringComparer.OrdinalIgnoreCase).ToArray());
    }

    private static CurrencyStrengthSnapshotDto CreateUnavailableSnapshot()
    {
        var composite = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["EUR"] = 0,
            ["GBP"] = 0,
            ["USD"] = 0,
            ["JPY"] = 0,
            ["AUD"] = 0,
            ["NZD"] = 0,
            ["CAD"] = 0,
            ["CHF"] = 0
        };

        var matrix = new Dictionary<string, IReadOnlyDictionary<string, decimal>>(StringComparer.OrdinalIgnoreCase);
        foreach (var currency in Currencies)
        {
            var tfScores = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            var baseScore = composite[currency];
            for (var index = 0; index < Timeframes.Length; index++)
            {
                tfScores[Timeframes[index]] = baseScore;
            }

            matrix[currency] = tfScores;
        }

        return new CurrencyStrengthSnapshotDto(
            "CacsmsCurrencyStrengthEngine",
            "unavailable",
            DateTimeOffset.UtcNow,
            "",
            "",
            "",
            "NO TRADE",
            0,
            0,
            0,
            "PENDING_DATA",
            "UNAVAILABLE",
            "N/A",
            "No production currency-strength snapshot has been ingested.",
            "",
            Timeframes,
            composite,
            matrix);
    }

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, decimal>> NormalizeMatrix(
        Dictionary<string, Dictionary<string, decimal>>? incoming,
        IReadOnlyDictionary<string, decimal> currencies)
    {
        if (incoming is null || incoming.Count == 0)
        {
            var fallback = new Dictionary<string, IReadOnlyDictionary<string, decimal>>(StringComparer.OrdinalIgnoreCase);
            foreach (var currency in currencies.Keys)
            {
                var tfScores = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                var baseScore = currencies[currency];
                foreach (var timeframe in Timeframes)
                {
                    tfScores[timeframe] = baseScore;
                }

                fallback[currency] = tfScores;
            }

            return fallback;
        }

        return incoming.ToDictionary(
            pair => pair.Key.ToUpperInvariant(),
            pair => (IReadOnlyDictionary<string, decimal>)pair.Value.ToDictionary(
                tf => NormalizeTimeframeKey(tf.Key),
                tf => Math.Clamp(tf.Value, -100, 100),
                StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeTimeframeKey(string timeframe)
    {
        var normalized = timeframe.Trim().ToUpperInvariant();
        return normalized switch
        {
            "Y" or "YTD" or "YEAR" or "YEARLY" => "Y1",
            _ => normalized
        };
    }

    private static string ResolveStrongest(IReadOnlyDictionary<string, decimal> currencies)
    {
        return currencies.OrderByDescending(pair => pair.Value).FirstOrDefault().Key ?? "EUR";
    }

    private static string ResolveWeakest(IReadOnlyDictionary<string, decimal> currencies)
    {
        return currencies.OrderBy(pair => pair.Value).FirstOrDefault().Key ?? "JPY";
    }

    private static decimal NormalizeCurrencyScore(decimal rawScore)
    {
        return Math.Clamp((rawScore + 100) / 2, 0, 100);
    }

    private static string NormalizeBias(string bias)
    {
        if (bias.Equals("BUY", StringComparison.OrdinalIgnoreCase))
        {
            return "BUY";
        }

        if (bias.Equals("SELL", StringComparison.OrdinalIgnoreCase))
        {
            return "SELL";
        }

        return "NO TRADE";
    }

    private static DateTimeOffset ParseUpdatedAt(string? updatedAt)
    {
        if (string.IsNullOrWhiteSpace(updatedAt))
        {
            return DateTimeOffset.UtcNow;
        }

        if (DateTimeOffset.TryParse(updatedAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed;
        }

        return DateTimeOffset.UtcNow;
    }

    private static List<string> SplitReasons(string reasons)
    {
        if (string.IsNullOrWhiteSpace(reasons) || reasons.Equals("None", StringComparison.OrdinalIgnoreCase))
        {
            return [];
        }

        return reasons
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(reason => !string.IsNullOrWhiteSpace(reason))
            .ToList();
    }
}
