using Cacsms.Engine.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class AiDecisionHttpClient(ILogger<AiDecisionHttpClient> logger) : IAiDecisionClient
{
    public Task<AiDecisionResponse> RequestDecisionAsync(AiDecisionRequest request, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("AI decision requested for {Symbol} in {TradingMode}.", request.Symbol, request.TradingMode);
        return Task.FromResult(new AiDecisionResponse("WAIT", request.ConfidenceScore, "AI service adapter is configured; Python service endpoint is pending."));
    }
}
