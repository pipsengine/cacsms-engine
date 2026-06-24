using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Decisioning;
using Cacsms.Engine.Application.Trading;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Infrastructure.Persistence;
using Cacsms.Engine.Infrastructure.Persistence.Options;
using Cacsms.Engine.Infrastructure.Persistence.Repositories;
using Cacsms.Engine.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;

namespace Cacsms.Engine.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCacsmsInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.AddSingleton(sp => sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseOptions>>().Value);

        ConfigureSqlServer(services, configuration);

        services.AddSingleton<IDecisionRecordRepository, EfDecisionRecordRepository>();
        services.AddSingleton<IDatabaseInitializer, DatabaseInitializer>();
        services.AddSingleton(typeof(IRepository<>), typeof(InMemoryRepository<>));
        services.AddSingleton<IUnitOfWork, InMemoryUnitOfWork>();
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

    public static IServiceCollection AddCacsmsDatabaseHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database");

        return services;
    }

    private static void ConfigureSqlServer(IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContextFactory<CacsmsEngineDbContext>((provider, options) =>
        {
            var environment = provider.GetRequiredService<IHostEnvironment>();
            var databaseOptions = provider.GetRequiredService<DatabaseOptions>();
            var connectionString = DatabaseConnectionStringFactory.Build(configuration, environment);

            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(CacsmsEngineDbContext).Assembly.GetName().Name);
                sql.EnableRetryOnFailure(
                    maxRetryCount: databaseOptions.MaxRetryCount,
                    maxRetryDelay: TimeSpan.FromSeconds(databaseOptions.MaxRetryDelaySeconds),
                    errorNumbersToAdd: null);
                sql.CommandTimeout(databaseOptions.CommandTimeoutSeconds);
            });
        });
    }
}

internal sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly IDbContextFactory<CacsmsEngineDbContext> _dbContextFactory;

    public DatabaseHealthCheck(IDbContextFactory<CacsmsEngineDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);

            return canConnect
                ? HealthCheckResult.Healthy("SQL Server connection is available.")
                : HealthCheckResult.Unhealthy("SQL Server connection failed.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("SQL Server connection failed.", exception);
        }
    }
}
