namespace Cacsms.Engine.Application.Decisioning;

public sealed record MarketMemoryRequest(
    decimal HistoricalSimilarityScore,
    decimal SimilarCaseWinRate,
    decimal CandleBodyScore,
    decimal WickRejectionScore,
    decimal CloseLocationScore,
    decimal CandleSequenceScore,
    decimal AsianH8Score,
    decimal LondonH8Score,
    decimal NewYorkH8Score,
    decimal D1ProjectionConfidence);

public sealed record MarketMemoryResponse(
    decimal HistoricalPatternScore,
    decimal CandleIntelligenceScore,
    decimal H8D1ProjectionScore,
    decimal MarketMemoryScore,
    string Recommendation,
    IReadOnlyCollection<string> Reasons);

