namespace Cacsms.Engine.Worker.Jobs;

public sealed class TradeMonitoringWorker(ILogger<TradeMonitoringWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Monitoring open trades, floating P/L, profit locks, and risk controls.");
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
