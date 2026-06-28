using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Intelligence;
using Cacsms.Engine.Application.Operations;
using Cacsms.Engine.Application.Trading;
using Cacsms.Engine.Domain.Trading;
using Cacsms.Engine.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class EngineOperationsService(
    IConfiguration configuration,
    IDbContextFactory<CacsmsEngineDbContext> dbContextFactory,
    ICurrencyStrengthIntelligenceService currencyStrengthService,
    ITradingUniverseService tradingUniverseService,
    IMt5TelemetryService mt5TelemetryService) : IEngineOperationsService
{
    private readonly object _sync = new();
    private EngineRuntimeStatusDto _status = new(
        "STOPPED",
        IsOnline: false,
        IsTradingEnabled: false,
        DateTimeOffset.UtcNow,
        "runtime",
        "Engine has not been started.");

    public EngineRuntimeStatusDto GetStatus()
    {
        lock (_sync)
        {
            return _status;
        }
    }

    public EngineRuntimeStatusDto Start(string reason)
    {
        lock (_sync)
        {
            _status = new EngineRuntimeStatusDto(
                "RUNNING",
                IsOnline: true,
                IsTradingEnabled: true,
                DateTimeOffset.UtcNow,
                "operator",
                NormalizeReason(reason, "Engine started by operator."));
            return _status;
        }
    }

    public EngineRuntimeStatusDto Stop(string reason)
    {
        lock (_sync)
        {
            _status = new EngineRuntimeStatusDto(
                "STOPPED",
                IsOnline: false,
                IsTradingEnabled: false,
                DateTimeOffset.UtcNow,
                "operator",
                NormalizeReason(reason, "Engine stopped by operator."));
            return _status;
        }
    }

    public RuntimeConfigDto GetRuntimeConfig()
    {
        return LoadRuntimeConfig();
    }

    public RuntimeConfigDto ReloadRuntimeConfig()
    {
        return LoadRuntimeConfig();
    }

    public async Task<DataSourcesOverviewDto> GetDataSourcesAsync(CancellationToken cancellationToken = default)
    {
        var checkedAt = DateTimeOffset.UtcNow;
        var sources = new List<DataSourceStatusDto>
        {
            new("ENGINE", "Engine Runtime", GetStatus().IsOnline ? "ONLINE" : "OFFLINE", GetStatus().IsOnline, checkedAt, GetStatus().Reason),
            await CheckDatabaseAsync(checkedAt, cancellationToken),
            CheckCurrencyStrength(checkedAt),
            CheckMt5Bridge(checkedAt),
            new("NEWS", "News / Macro Feed", "UNAVAILABLE", false, checkedAt, "No production news provider is configured."),
        };

        return new DataSourcesOverviewDto(
            checkedAt,
            sources.Count(source => source.Status is "ONLINE" or "HEALTHY"),
            sources.Count(source => source.Status is "DEGRADED" or "UNAVAILABLE"),
            sources.Count(source => source.Status is "OFFLINE"),
            sources);
    }

    public SymbolSelectionRulesOverviewDto GetSymbolSelectionRules()
    {
        var snapshot = currencyStrengthService.GetLatest();
        var approvedSymbols = tradingUniverseService.GetApprovedSymbols();
        var candidates = BuildCandidates(snapshot, approvedSymbols);
        var hasLiveStrength = !snapshot.Source.Equals("unavailable", StringComparison.OrdinalIgnoreCase);

        var rules = new[]
        {
            new SymbolSelectionRuleDto(
                "FX_STRONG_WEAK",
                "FX Strong-vs-Weak Pair Rule",
                "Approved FX symbols are eligible only when the base currency is materially stronger than the quote currency for buys, or weaker for sells.",
                hasLiveStrength ? "ACTIVE" : "PENDING_DATA"),
            new SymbolSelectionRuleDto(
                "XAU_INVERSE_USD",
                "XAUUSD Inverse USD Rule",
                "XAUUSD buy setups require USD weakness; XAUUSD sell setups require USD strength. Mixed USD strength blocks scalps.",
                hasLiveStrength ? "ACTIVE" : "PENDING_DATA"),
            new SymbolSelectionRuleDto(
                "MIXED_STRENGTH_BLOCK",
                "Mixed Strength Safety Rule",
                "If strength differential or confidence is below institutional threshold, route to No Trade or Manual Review.",
                hasLiveStrength ? "ACTIVE" : "PENDING_DATA"),
        };

        return new SymbolSelectionRulesOverviewDto(
            DateTimeOffset.UtcNow,
            hasLiveStrength ? "ACTIVE" : "PENDING_DATA",
            rules,
            candidates);
    }

    private RuntimeConfigDto LoadRuntimeConfig()
    {
        return new RuntimeConfigDto(
            Read("CACSMS_TRADING_MODE", "Trading:Mode", "ManualApproval"),
            Read("CACSMS_AUTONOMY_LEVEL", "Trading:AutonomyLevel", "ManualReview"),
            Read("CACSMS_RISK_PROFILE", "Risk:Profile", "NotConfigured"),
            ReadDecimal("CACSMS_MAX_RISK_PER_TRADE_PERCENT", "Risk:MaxRiskPerTradePercent"),
            ReadDecimal("CACSMS_DAILY_DRAWDOWN_LIMIT_PERCENT", "Risk:DailyDrawdownLimitPercent"),
            ReadBool("CACSMS_DEMO_EXECUTION_ENABLED", "Trading:DemoExecutionEnabled"),
            ReadBool("CACSMS_LIVE_EXECUTION_ENABLED", "Trading:LiveExecutionEnabled"),
            ReadBool("CACSMS_PROP_FIRM_MODE_ENABLED", "Trading:PropFirmModeEnabled"),
            DateTimeOffset.UtcNow,
            "configuration");
    }

    private async Task<DataSourceStatusDto> CheckDatabaseAsync(DateTimeOffset checkedAt, CancellationToken cancellationToken)
    {
        try
        {
            await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? new DataSourceStatusDto("SQL", "SQL Server", "HEALTHY", true, checkedAt, "Database connection succeeded.")
                : new DataSourceStatusDto("SQL", "SQL Server", "OFFLINE", false, checkedAt, "Database connection failed.");
        }
        catch (Exception exception)
        {
            return new DataSourceStatusDto("SQL", "SQL Server", "OFFLINE", false, checkedAt, exception.Message);
        }
    }

    private DataSourceStatusDto CheckCurrencyStrength(DateTimeOffset checkedAt)
    {
        var snapshot = currencyStrengthService.GetLatest();
        var healthy = !snapshot.Source.Equals("unavailable", StringComparison.OrdinalIgnoreCase);
        return new DataSourceStatusDto(
            "CURRENCY_STRENGTH",
            "Currency Strength Feed",
            healthy ? "ONLINE" : "UNAVAILABLE",
            healthy,
            checkedAt,
            healthy
                ? $"Latest snapshot from {snapshot.Source} at {snapshot.UpdatedAt:u}."
                : "No production currency-strength snapshot has been ingested.");
    }

    private DataSourceStatusDto CheckMt5Bridge(DateTimeOffset checkedAt)
    {
        var lastHeartbeatAt = mt5TelemetryService.LastHeartbeatAt;
        if (lastHeartbeatAt is null)
        {
            return new DataSourceStatusDto(
                "MT5",
                "MT5 Bridge",
                "OFFLINE",
                false,
                checkedAt,
                "No MT5 bridge heartbeat has been received by this API process.");
        }

        var heartbeatAgeSeconds = (checkedAt - lastHeartbeatAt.Value).TotalSeconds;
        var isFresh = heartbeatAgeSeconds <= 30;
        return new DataSourceStatusDto(
            "MT5",
            "MT5 Bridge",
            isFresh ? "ONLINE" : "DEGRADED",
            isFresh,
            checkedAt,
            $"Last local MT5 heartbeat received {Math.Max(0, heartbeatAgeSeconds):0}s ago.");
    }

    private IReadOnlyCollection<SymbolSelectionCandidateDto> BuildCandidates(
        CurrencyStrengthSnapshotDto snapshot,
        IReadOnlyCollection<TradingSymbol> approvedSymbols)
    {
        if (snapshot.Source.Equals("unavailable", StringComparison.OrdinalIgnoreCase) || snapshot.Currencies.Count == 0)
        {
            return [];
        }

        var candidates = new List<SymbolSelectionCandidateDto>();
        foreach (var symbol in approvedSymbols)
        {
            var code = symbol.Code.ToUpperInvariant();
            if (code.Equals("XAUUSD", StringComparison.OrdinalIgnoreCase))
            {
                candidates.Add(BuildXauCandidate(snapshot));
                continue;
            }

            if (code.Length < 6) continue;

            var baseCurrency = code[..3];
            var quoteCurrency = code[3..6];
            if (!snapshot.Currencies.TryGetValue(baseCurrency, out var baseScore)
                || !snapshot.Currencies.TryGetValue(quoteCurrency, out var quoteScore))
            {
                continue;
            }

            var differential = baseScore - quoteScore;
            var direction = differential > 0 ? "BUY" : "SELL";
            var score = Math.Clamp(Math.Abs(differential), 0, 100);
            var status = score >= 35 && snapshot.Confidence >= 60 ? "ELIGIBLE" : "MANUAL_REVIEW";
            candidates.Add(new SymbolSelectionCandidateDto(
                code,
                direction,
                score,
                status,
                [
                    $"{baseCurrency} strength {baseScore:0.0}.",
                    $"{quoteCurrency} strength {quoteScore:0.0}.",
                    $"Differential {differential:0.0}.",
                ]));
        }

        return candidates
            .OrderByDescending(candidate => candidate.Score)
            .Take(8)
            .ToArray();
    }

    private static SymbolSelectionCandidateDto BuildXauCandidate(CurrencyStrengthSnapshotDto snapshot)
    {
        snapshot.Currencies.TryGetValue("USD", out var usdScore);
        var direction = usdScore < -15 ? "BUY" : usdScore > 15 ? "SELL" : "NO_TRADE";
        var score = Math.Clamp(Math.Abs(usdScore), 0, 100);
        var status = direction == "NO_TRADE" ? "BLOCKED" : score >= 25 && snapshot.Confidence >= 60 ? "ELIGIBLE" : "MANUAL_REVIEW";

        return new SymbolSelectionCandidateDto(
            "XAUUSD",
            direction,
            score,
            status,
            [
                $"USD strength {usdScore:0.0}.",
                "XAUUSD uses inverse USD strength.",
                direction == "NO_TRADE" ? "USD is mixed; scalp blocked." : $"Inverse USD rule indicates {direction}.",
            ]);
    }

    private string Read(string environmentKey, string configurationKey, string fallback)
    {
        return Environment.GetEnvironmentVariable(environmentKey)
            ?? configuration[configurationKey]
            ?? fallback;
    }

    private decimal ReadDecimal(string environmentKey, string configurationKey)
    {
        var value = Environment.GetEnvironmentVariable(environmentKey) ?? configuration[configurationKey];
        return decimal.TryParse(value, out var parsed) ? parsed : 0;
    }

    private bool ReadBool(string environmentKey, string configurationKey)
    {
        var value = Environment.GetEnvironmentVariable(environmentKey) ?? configuration[configurationKey];
        return bool.TryParse(value, out var parsed) && parsed;
    }

    private static string NormalizeReason(string reason, string fallback)
    {
        return string.IsNullOrWhiteSpace(reason) ? fallback : reason.Trim();
    }
}
