using Cacsms.Engine.Application.Abstractions;

namespace Cacsms.Engine.Mt5Bridge.Bridge;

public sealed class Mt5MessageRouter(ILogger<Mt5MessageRouter> logger)
{
    public Task RouteAsync(string rawMessage, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Received MT5 bridge message: {Message}", rawMessage);
        return Task.CompletedTask;
    }

    public Task SendOrderAsync(Mt5OrderRequest order, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Prepared MT5 order for {Symbol} with correlation {CorrelationId}.", order.Symbol, order.CorrelationId);
        return Task.CompletedTask;
    }
}
