namespace Cacsms.Engine.Application.Intelligence;

public interface ICotPositioningService
{
    Task<CotPositioningSnapshotDto> GetLatestAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyCollection<CotPositioningRowDto>> GetHistoryAsync(
        string? symbol = null,
        CancellationToken cancellationToken = default);

    Task<CotPositioningSnapshotDto> UpsertAsync(
        CotPositioningUpsertRequest request,
        CancellationToken cancellationToken = default);
}
