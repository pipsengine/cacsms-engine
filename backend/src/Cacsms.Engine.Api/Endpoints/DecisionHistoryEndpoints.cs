using Cacsms.Engine.Application.Decisioning;

namespace Cacsms.Engine.Api.Endpoints;

public static class DecisionHistoryEndpoints
{
    public static IEndpointRouteBuilder MapDecisionHistoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/decisions").WithTags("Decision History");

        group.MapGet("/", async (
            IDecisionHistoryService decisionHistoryService,
            int? limit,
            CancellationToken cancellationToken) =>
        {
            var history = await decisionHistoryService.ListRecentAsync(limit ?? 50, cancellationToken);
            return Results.Ok(history);
        });

        return endpoints;
    }
}
