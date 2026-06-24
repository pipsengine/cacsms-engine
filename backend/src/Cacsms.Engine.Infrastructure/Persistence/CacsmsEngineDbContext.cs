using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Cacsms.Engine.Infrastructure.Persistence.Options;
using Microsoft.EntityFrameworkCore;

namespace Cacsms.Engine.Infrastructure.Persistence;

public sealed class CacsmsEngineDbContext : DbContext
{
    private readonly DatabaseOptions _databaseOptions;

    public CacsmsEngineDbContext(DbContextOptions<CacsmsEngineDbContext> options, DatabaseOptions databaseOptions)
        : base(options)
    {
        _databaseOptions = databaseOptions;
    }

    public DbSet<DecisionRecordEntity> DecisionRecords => Set<DecisionRecordEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var schema = string.IsNullOrWhiteSpace(_databaseOptions.Schema)
            ? "engine"
            : _databaseOptions.Schema;

        modelBuilder.HasDefaultSchema(schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CacsmsEngineDbContext).Assembly);
    }
}
