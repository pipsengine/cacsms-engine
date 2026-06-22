namespace Cacsms.Engine.Application.Decisioning;

public sealed record PersistedHybridDecisionResponse(
    Guid DecisionId,
    DateTimeOffset CreatedAt,
    HybridDecisionResponse Decision);

public sealed record DecisionHistoryItemDto(
    Guid DecisionId,
    DateTimeOffset CreatedAt,
    string Symbol,
    string TradingMode,
    string Recommendation,
    string Direction,
    decimal ConfidenceScore);
