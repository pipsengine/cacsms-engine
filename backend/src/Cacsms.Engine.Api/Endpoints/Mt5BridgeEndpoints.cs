using System.Text.Json;
using Cacsms.Engine.Application.Abstractions;

namespace Cacsms.Engine.Api.Endpoints;

public static class Mt5BridgeEndpoints
{
    public static IEndpointRouteBuilder MapMt5BridgeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/heartbeat", (JsonElement heartbeat, IMt5TelemetryService telemetryService) =>
        {
            var snapshot = telemetryService.IngestHeartbeat(heartbeat);
            return Results.Ok(new
            {
                accepted = true,
                receivedAt = DateTimeOffset.UtcNow,
                currencyStrength = new
                {
                    snapshot.Source,
                    snapshot.UpdatedAt,
                    snapshot.Strongest,
                    snapshot.Weakest,
                    snapshot.Confidence,
                    snapshot.StrengthDifferential,
                    snapshot.XauUsdFilter
                }
            });
        });

        endpoints.MapGet("/commands/next", () => Results.Ok(new { command = (object?)null }));

        return endpoints;
    }
}
