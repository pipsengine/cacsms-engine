namespace Cacsms.Engine.Application.Abstractions;

public interface IAiDecisionClient
{
    Task<AiDecisionResponse> RequestDecisionAsync(AiDecisionRequest request, CancellationToken cancellationToken = default);
}

public sealed record AiDecisionRequest(
    string Symbol,
    string TradingMode,
    decimal ConfidenceScore,
    decimal RiskScore);

public sealed record AiDecisionResponse(
    string Decision,
    decimal ConfidenceScore,
    string Reason);
