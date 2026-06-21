using Cacsms.Engine.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class Mt5BridgeClient(ILogger<Mt5BridgeClient> logger) : IMt5BridgeClient
{
    public Task PublishOrderAsync(Mt5OrderRequest order, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("MT5 order publish requested for {Symbol} with correlation {CorrelationId}.", order.Symbol, order.CorrelationId);
        return Task.CompletedTask;
    }
}
