using Cacsms.Engine.Application.Trading;

namespace Cacsms.Engine.Api.Endpoints;

public static class TradingUniverseEndpoints
{
    public static IEndpointRouteBuilder MapTradingUniverseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/trading-universe").WithTags("Trading Universe");

        group.MapGet("/symbols", (ITradingUniverseService tradingUniverseService) =>
        {
            return Results.Ok(tradingUniverseService.GetApprovedSymbols());
        });

        return endpoints;
    }
}
