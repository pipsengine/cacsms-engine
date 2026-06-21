namespace Cacsms.Engine.Application.Realtime;

public interface ITradingEventPublisher
{
    Task PublishWorkflowStatusChangedAsync(object payload, CancellationToken cancellationToken = default);
    Task PublishTradeUpdateAsync(object payload, CancellationToken cancellationToken = default);
    Task PublishNotificationAsync(object payload, CancellationToken cancellationToken = default);
}
