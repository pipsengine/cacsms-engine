using Cacsms.Engine.Domain.Abstractions;

namespace Cacsms.Engine.Domain.Decisioning;

public sealed class DecisionRecord : AggregateRoot
{
    public string Symbol { get; private init; } = string.Empty;
    public string TradingMode { get; private init; } = string.Empty;
    public string Recommendation { get; private init; } = string.Empty;
    public string Direction { get; private init; } = string.Empty;
    public decimal ConfidenceScore { get; private init; }
    public string RequestJson { get; private init; } = string.Empty;
    public string ResponseJson { get; private init; } = string.Empty;

    public static DecisionRecord Create(
        string symbol,
        string tradingMode,
        string recommendation,
        string direction,
        decimal confidenceScore,
        string requestJson,
        string responseJson)
    {
        return new DecisionRecord
        {
            Symbol = symbol,
            TradingMode = tradingMode,
            Recommendation = recommendation,
            Direction = direction,
            ConfidenceScore = confidenceScore,
            RequestJson = requestJson,
            ResponseJson = responseJson
        };
    }

    public static DecisionRecord FromPersistence(
        Guid id,
        DateTimeOffset createdAt,
        string symbol,
        string tradingMode,
        string recommendation,
        string direction,
        decimal confidenceScore,
        string requestJson,
        string responseJson)
    {
        return new DecisionRecord
        {
            Id = id,
            CreatedAt = createdAt,
            Symbol = symbol,
            TradingMode = tradingMode,
            Recommendation = recommendation,
            Direction = direction,
            ConfidenceScore = confidenceScore,
            RequestJson = requestJson,
            ResponseJson = responseJson
        };
    }
}
