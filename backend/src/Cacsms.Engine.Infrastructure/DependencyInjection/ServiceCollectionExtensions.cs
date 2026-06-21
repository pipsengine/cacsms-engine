using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Decisioning;
using Cacsms.Engine.Application.Trading;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Infrastructure.Persistence;
using Cacsms.Engine.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Cacsms.Engine.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCacsmsInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton(typeof(IRepository<>), typeof(InMemoryRepository<>));
        services.AddSingleton<IUnitOfWork, InMemoryUnitOfWork>();
        services.AddSingleton<IWorkflowStatusService, WorkflowStatusService>();
        services.AddSingleton<ITradingUniverseService, TradingUniverseService>();
        services.AddSingleton<IHybridDecisionService, HybridDecisionService>();
        services.AddSingleton<IMacroIntelligenceService, MacroIntelligenceService>();
        services.AddSingleton<IAdvancedAlgorithmService, AdvancedAlgorithmService>();
        services.AddSingleton<IMarketMemoryService, MarketMemoryService>();
        services.AddSingleton<IMultiTimeframeBiasService, MultiTimeframeBiasService>();
        services.AddHttpClient<IAiDecisionClient, AiDecisionHttpClient>();
        services.AddSingleton<IMt5BridgeClient, Mt5BridgeClient>();
        return services;
    }
}
