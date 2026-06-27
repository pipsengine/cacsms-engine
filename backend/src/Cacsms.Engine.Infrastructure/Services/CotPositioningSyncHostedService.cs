using Cacsms.Engine.Application.Intelligence;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class CotPositioningSyncHostedService : BackgroundService
{
    private readonly ICotPositioningSyncService _syncService;
    private readonly ILogger<CotPositioningSyncHostedService> _logger;

    public CotPositioningSyncHostedService(
        ICotPositioningSyncService syncService,
        ILogger<CotPositioningSyncHostedService> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var nextRun = GetNextSaturdayMidnight(DateTimeOffset.Now);
            var delay = nextRun - DateTimeOffset.Now;

            if (delay > TimeSpan.Zero)
            {
                _logger.LogInformation("Next CFTC COT sync scheduled for {NextRun}.", nextRun);
                await Task.Delay(delay, stoppingToken);
            }

            if (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            var result = await _syncService.SyncLastTwoYearsAsync(stoppingToken);
            _logger.LogInformation(
                "CFTC COT sync completed with status {Status}: {Message}",
                result.Status,
                result.Message);

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private static DateTimeOffset GetNextSaturdayMidnight(DateTimeOffset now)
    {
        var todayMidnight = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, now.Offset);
        var daysUntilSaturday = ((int)DayOfWeek.Saturday - (int)now.DayOfWeek + 7) % 7;
        var nextRun = todayMidnight.AddDays(daysUntilSaturday);

        return nextRun <= now ? nextRun.AddDays(7) : nextRun;
    }
}
