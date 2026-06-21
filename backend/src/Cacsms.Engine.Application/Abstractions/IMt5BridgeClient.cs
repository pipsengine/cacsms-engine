namespace Cacsms.Engine.Application.Abstractions;

public interface IMt5BridgeClient
{
    Task PublishOrderAsync(Mt5OrderRequest order, CancellationToken cancellationToken = default);
}

public sealed record Mt5OrderRequest(
    string Symbol,
    string OrderType,
    decimal Volume,
    decimal StopLoss,
    decimal TakeProfit,
    string CorrelationId);
