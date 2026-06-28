using Cacsms.Engine.Application.Abstractions;

namespace Cacsms.Engine.Api.Endpoints;

public static class EngineOperationsEndpoints
{
    public static IEndpointRouteBuilder MapEngineOperationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var engine = endpoints.MapGroup("/api/engine").WithTags("Engine");

        engine.MapGet("/status", (IEngineOperationsService service) =>
            Results.Ok(service.GetStatus()));

        engine.MapPost("/start", (EngineCommandRequest request, IEngineOperationsService service) =>
            Results.Ok(service.Start(request.Reason ?? string.Empty)));

        engine.MapPost("/stop", (EngineCommandRequest request, IEngineOperationsService service) =>
            Results.Ok(service.Stop(request.Reason ?? string.Empty)));

        var runtime = endpoints.MapGroup("/api/runtime").WithTags("Runtime");

        runtime.MapGet("/config", (IEngineOperationsService service) =>
            Results.Ok(service.GetRuntimeConfig()));

        runtime.MapPost("/config/reload", (IEngineOperationsService service) =>
            Results.Ok(service.ReloadRuntimeConfig()));

        var system = endpoints.MapGroup("/api/system").WithTags("System");

        system.MapGet("/data-sources/status", async (IEngineOperationsService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetDataSourcesAsync(cancellationToken)));

        var selection = endpoints.MapGroup("/api/symbol-selection").WithTags("Symbol Selection");

        selection.MapGet("/rules", (IEngineOperationsService service) =>
            Results.Ok(service.GetSymbolSelectionRules()));

        return endpoints;
    }
}

public sealed record EngineCommandRequest(string? Reason);
