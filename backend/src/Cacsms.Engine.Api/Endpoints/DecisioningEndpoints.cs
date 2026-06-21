using Cacsms.Engine.Application.Decisioning;

namespace Cacsms.Engine.Api.Endpoints;

public static class DecisioningEndpoints
{
    public static IEndpointRouteBuilder MapDecisioningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/decisioning").WithTags("Decisioning");

        group.MapPost("/hybrid-evaluate", (HybridDecisionRequest request, IHybridDecisionService decisionService) =>
        {
            return Results.Ok(decisionService.Evaluate(request));
        });

        group.MapPost("/macro-evaluate", (MacroIntelligenceRequest request, IMacroIntelligenceService macroService) =>
        {
            return Results.Ok(macroService.Evaluate(request));
        });

        group.MapPost("/advanced-algorithm-evaluate", (AdvancedAlgorithmRequest request, IAdvancedAlgorithmService algorithmService) =>
        {
            return Results.Ok(algorithmService.Evaluate(request));
        });

        group.MapPost("/market-memory-evaluate", (MarketMemoryRequest request, IMarketMemoryService marketMemoryService) =>
        {
            return Results.Ok(marketMemoryService.Evaluate(request));
        });

        group.MapPost("/multi-timeframe-bias-evaluate", (MultiTimeframeBiasRequest request, IMultiTimeframeBiasService biasService) =>
        {
            return Results.Ok(biasService.Evaluate(request));
        });

        return endpoints;
    }
}
