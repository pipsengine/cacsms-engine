using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Api.Endpoints;

public static class CurrencyStrengthEndpoints
{
    public static IEndpointRouteBuilder MapCurrencyStrengthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/intelligence").WithTags("Intelligence");

        group.MapGet("/currency-strength/latest", (ICurrencyStrengthIntelligenceService service) =>
            Results.Ok(service.GetLatest()));

        group.MapPost("/currency-strength", (CurrencyStrengthIngestRequest request, ICurrencyStrengthIntelligenceService service) =>
            Results.Ok(service.Ingest(request)));

        group.MapGet("/currency-strength/enrich/{symbol}", (string symbol, ICurrencyStrengthIntelligenceService service) =>
            Results.Ok(service.EnrichForSymbol(symbol)));

        return endpoints;
    }
}
