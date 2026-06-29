using System.Text;
using System.Text.Json;
using Cacsms.Engine.Application.Abstractions;

namespace Cacsms.Engine.Api.Endpoints;

public static class Mt5BridgeEndpoints
{
    public static IEndpointRouteBuilder MapMt5BridgeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/heartbeat", async (HttpRequest request, IMt5TelemetryService telemetryService) =>
        {
            using var reader = new StreamReader(request.Body, Encoding.UTF8);
            var payload = (await reader.ReadToEndAsync()).TrimEnd('\0', '\uFEFF', ' ', '\r', '\n', '\t');

            if (string.IsNullOrWhiteSpace(payload))
            {
                return Results.BadRequest(new { accepted = false, error = "Heartbeat payload is empty." });
            }

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(payload);
            }
            catch (JsonException exception)
            {
                return Results.BadRequest(new { accepted = false, error = "Heartbeat payload is not valid JSON.", detail = exception.Message });
            }

            using (document)
            {
                var snapshot = telemetryService.IngestHeartbeat(document.RootElement);
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
            }
        });

        endpoints.MapGet("/commands/next", () => Results.Ok(new { command = (object?)null }));

        return endpoints;
    }
}
