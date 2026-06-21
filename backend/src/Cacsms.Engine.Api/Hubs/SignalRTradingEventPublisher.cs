using Cacsms.Engine.Application.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Cacsms.Engine.Api.Hubs;

public sealed class SignalRTradingEventPublisher(IHubContext<TradingHub> hubContext) : ITradingEventPublisher
{
    public Task PublishWorkflowStatusChangedAsync(object payload, CancellationToken cancellationToken = default)
    {
        return hubContext.Clients.Group("workflow-status").SendAsync("workflowStatusChanged", payload, cancellationToken);
    }

    public Task PublishTradeUpdateAsync(object payload, CancellationToken cancellationToken = default)
    {
        return hubContext.Clients.All.SendAsync("tradeUpdated", payload, cancellationToken);
    }

    public Task PublishNotificationAsync(object payload, CancellationToken cancellationToken = default)
    {
        return hubContext.Clients.All.SendAsync("notificationReceived", payload, cancellationToken);
    }
}
