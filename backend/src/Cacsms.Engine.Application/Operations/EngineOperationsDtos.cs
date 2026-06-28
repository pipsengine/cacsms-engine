namespace Cacsms.Engine.Application.Operations;

public sealed record EngineRuntimeStatusDto(
    string State,
    bool IsOnline,
    bool IsTradingEnabled,
    DateTimeOffset UpdatedAt,
    string Source,
    string Reason);

public sealed record RuntimeConfigDto(
    string TradingMode,
    string AutonomyLevel,
    string RiskProfile,
    decimal MaxRiskPerTradePercent,
    decimal DailyDrawdownLimitPercent,
    bool DemoExecutionEnabled,
    bool LiveExecutionEnabled,
    bool PropFirmModeEnabled,
    DateTimeOffset LoadedAt,
    string Source);

public sealed record DataSourceStatusDto(
    string Code,
    string Name,
    string Status,
    bool IsHealthy,
    DateTimeOffset CheckedAt,
    string Detail);

public sealed record DataSourcesOverviewDto(
    DateTimeOffset CheckedAt,
    int Healthy,
    int Degraded,
    int Offline,
    IReadOnlyCollection<DataSourceStatusDto> Sources);

public sealed record SymbolSelectionRuleDto(
    string Code,
    string Name,
    string Description,
    string Status);

public sealed record SymbolSelectionCandidateDto(
    string Symbol,
    string Direction,
    decimal Score,
    string Status,
    IReadOnlyCollection<string> Evidence);

public sealed record SymbolSelectionRulesOverviewDto(
    DateTimeOffset EvaluatedAt,
    string Status,
    IReadOnlyCollection<SymbolSelectionRuleDto> Rules,
    IReadOnlyCollection<SymbolSelectionCandidateDto> Candidates);
