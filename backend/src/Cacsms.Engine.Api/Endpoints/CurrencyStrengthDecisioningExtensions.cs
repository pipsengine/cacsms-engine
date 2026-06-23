using Cacsms.Engine.Application.Decisioning;

namespace Cacsms.Engine.Api.Endpoints;

public static class CurrencyStrengthDecisioningExtensions
{
    public static void MapCurrencyStrengthDecisioningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/decisioning").WithTags("Decisioning");

        group.MapPost("/hybrid-evaluate/live-currency-strength", (
            HybridDecisionRequest request,
            LiveCurrencyStrengthHybridEvaluator evaluator) =>
            Results.Ok(evaluator.Evaluate(request)));
    }
}
