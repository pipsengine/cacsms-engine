namespace Cacsms.Engine.Application.Intelligence;

public interface ICotPositioningSyncService
{
    CotPositioningSyncResultDto? LastResult { get; }

    Task<CotPositioningSyncResultDto> SyncLastTwoYearsAsync(CancellationToken cancellationToken = default);
}
