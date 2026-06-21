using Cacsms.Engine.Application.Abstractions;

namespace Cacsms.Engine.Api.Endpoints;

public static class WorkflowEndpoints
{
    public static IEndpointRouteBuilder MapWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/workflow").WithTags("Workflow");

        group.MapGet("/status", async (IWorkflowStatusService workflowStatusService, CancellationToken cancellationToken) =>
        {
            var overview = await workflowStatusService.GetOverviewAsync(cancellationToken);
            return Results.Ok(overview);
        });

        return endpoints;
    }
}
