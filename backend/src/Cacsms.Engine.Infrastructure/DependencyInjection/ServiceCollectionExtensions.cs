using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Decisioning;
using Cacsms.Engine.Application.Trading;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Infrastructure.Persistence;
using Cacsms.Engine.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Cacsms.Engine.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCacsmsInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton(typeof(IRepository<>), typeof(InMemoryRepository<>));
        services.AddSingleton<IUnitOfWork, InMemoryUnitOfWork>();
        services.AddSingleton<IDecisionRecordRepository>(provider =>
        {
            var configuration = provider.GetRequiredService<IConfiguration>();
            var environment = provider.GetRequiredService<IHostEnvironment>();
            var connectionString = ResolveDecisionStoreConnectionString(configuration, environment);

            var repository = new SqliteDecisionRecordRepository(connectionString);
            repository.Initialize();
            return repository;
        });
        services.AddSingleton<IWorkflowStatusService, WorkflowStatusService>();
        services.AddSingleton<ITradingUniverseService, TradingUniverseService>();
        services.AddSingleton<IHybridDecisionService, HybridDecisionService>();
        services.AddSingleton<IMacroIntelligenceService, MacroIntelligenceService>();
        services.AddSingleton<IAdvancedAlgorithmService, AdvancedAlgorithmService>();
        services.AddSingleton<IMarketMemoryService, MarketMemoryService>();
        services.AddSingleton<IMultiTimeframeBiasService, MultiTimeframeBiasService>();
        services.AddSingleton<IDecisionHistoryService, DecisionHistoryService>();
        services.AddHttpClient<IAiDecisionClient, AiDecisionHttpClient>();
        services.AddSingleton<IMt5BridgeClient, Mt5BridgeClient>();
        return services;
    }

    private static string ResolveDecisionStoreConnectionString(IConfiguration configuration, IHostEnvironment environment)
    {
        var configuredPath = configuration.GetConnectionString("DecisionStore");
        var relativePath = string.IsNullOrWhiteSpace(configuredPath)
            ? "data/cacsms-decisions.db"
            : configuredPath.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase)
                ? configuredPath["Data Source=".Length..]
                : configuredPath;

        var databasePath = Path.IsPathRooted(relativePath)
            ? relativePath
            : Path.Combine(environment.ContentRootPath, relativePath);

        var directory = Path.GetDirectoryName(databasePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        return $"Data Source={databasePath}";
    }
}
