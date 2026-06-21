using Microsoft.AspNetCore.SignalR;

namespace Cacsms.Engine.Api.Hubs;

public sealed class TradingHub : Hub
{
    public Task JoinAccountGroup(string accountId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, $"account:{accountId}");
    }

    public Task JoinWorkflowGroup()
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, "workflow-status");
    }
}
