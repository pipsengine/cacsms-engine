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

        group.MapGet("/history", async (
            string? symbol,
            ICotPositioningService service,
            CancellationToken cancellationToken) =>
        {
            var rows = await service.GetHistoryAsync(symbol, cancellationToken);
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

        group.MapPost("/sync/cftc-futures-only", async (
            ICotPositioningSyncService syncService,
            CancellationToken cancellationToken) =>
        {
            var result = await syncService.SyncLastTwoYearsAsync(cancellationToken);
            return Results.Ok(result);
        });

        group.MapGet("/sync/status", (ICotPositioningSyncService syncService) =>
            syncService.LastResult is { } result ? Results.Ok(result) : Results.NoContent());

        return endpoints;
    }
}
