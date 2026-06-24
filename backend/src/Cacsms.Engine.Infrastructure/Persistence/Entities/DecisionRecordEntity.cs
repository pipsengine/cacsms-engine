namespace Cacsms.Engine.Infrastructure.Persistence.Entities;

public sealed class DecisionRecordEntity
{
    public Guid Id { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string TradingMode { get; set; } = string.Empty;

    public string Recommendation { get; set; } = string.Empty;

    public string Direction { get; set; } = string.Empty;

    public decimal ConfidenceScore { get; set; }

    public string RequestJson { get; set; } = string.Empty;

    public string ResponseJson { get; set; } = string.Empty;
}
