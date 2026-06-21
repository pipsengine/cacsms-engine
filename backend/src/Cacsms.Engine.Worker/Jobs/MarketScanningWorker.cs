using Cacsms.Engine.Application.Trading;

namespace Cacsms.Engine.Worker.Jobs;

public sealed class MarketScanningWorker(
    ITradingUniverseService tradingUniverseService,
    ILogger<MarketScanningWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var symbols = tradingUniverseService.GetApprovedSymbols();
            logger.LogInformation("Scanning {SymbolCount} approved symbols for opportunities.", symbols.Count);
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}
