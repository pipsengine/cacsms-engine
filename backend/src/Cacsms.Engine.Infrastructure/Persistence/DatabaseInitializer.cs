using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Cacsms.Engine.Infrastructure.Persistence;

public interface IDatabaseInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}

internal sealed class DatabaseInitializer : IDatabaseInitializer
{
    private readonly IDbContextFactory<CacsmsEngineDbContext> _dbContextFactory;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(
        IDbContextFactory<CacsmsEngineDbContext> dbContextFactory,
        ILogger<DatabaseInitializer> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        _logger.LogInformation(
            "Applying database migrations for {Database}",
            dbContext.Database.GetDbConnection().Database);

        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
