namespace Cacsms.Engine.Mt5Bridge.Bridge;

public sealed class Mt5BridgeWorker(
    Mt5MessageRouter router,
    ILogger<Mt5BridgeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("MT5 Bridge Service started. Awaiting EA WebSocket messages.");

        while (!stoppingToken.IsCancellationRequested)
        {
            await router.RouteAsync("heartbeat", stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
