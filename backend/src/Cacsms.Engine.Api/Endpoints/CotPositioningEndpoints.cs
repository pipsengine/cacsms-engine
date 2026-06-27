using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Api.Endpoints;

public static class CotPositioningEndpoints
{
    public static IEndpointRouteBuilder MapCotPositioningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/intelligence/cot-positioning").WithTags("COT Positioning");

        group.MapGet("/latest", async (
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var snapshot = await service.GetLatestAsync(cancellationToken);
            return Results.Ok(snapshot);
        });

        group.MapGet("/snapshots/{reportDate}", async (
            DateOnly reportDate,
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var snapshot = await service.GetByDateAsync(reportDate, cancellationToken);
            return snapshot is null ? Results.NotFound() : Results.Ok(snapshot);
        });

        group.MapGet("/report-dates", async (
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var dates = await service.GetAvailableReportDatesAsync(cancellationToken);
            return Results.Ok(dates);
        });

        group.MapGet("/history", async (
            string? symbol,
            string? exchange,
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var rows = await service.GetHistoryAsync(symbol, exchange, cancellationToken);
            return Results.Ok(rows);
        });

        group.MapPost("/snapshots", async (
            CotPositioningUpsertRequest request,
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var snapshot = await service.UpsertAsync(request, cancellationToken);
            return Results.Ok(snapshot);
        });

        group.MapPost("/sync/cftc-futures-only", (
            ICotPositioningSyncService syncService) =>
        {
            _ = Task.Run(() => syncService.SyncLastTwoYearsAsync(CancellationToken.None));
            return Results.Accepted("/api/intelligence/cot-positioning/sync/status");
        });

        group.MapGet("/sync/status", (ICotPositioningSyncService syncService) =>
            syncService.LastResult is { } result ? Results.Ok(result) : Results.NoContent());

        return endpoints;
    }
}
