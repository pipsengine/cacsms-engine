using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Domain.Decisioning;
using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cacsms.Engine.Infrastructure.Persistence.Repositories;

internal sealed class EfDecisionRecordRepository : IDecisionRecordRepository
{
    private readonly IDbContextFactory<CacsmsEngineDbContext> _dbContextFactory;

    public EfDecisionRecordRepository(IDbContextFactory<CacsmsEngineDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    public async Task AddAsync(DecisionRecord record, CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        dbContext.DecisionRecords.Add(MapToEntity(record));
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<DecisionRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var entity = await dbContext.DecisionRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(record => record.Id == id, cancellationToken);

        return entity is null ? null : MapToDomain(entity);
    }

    public async Task<IReadOnlyCollection<DecisionRecord>> ListRecentAsync(
        int limit,
        CancellationToken cancellationToken = default)
    {
        var boundedLimit = Math.Clamp(limit, 1, 200);

        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var entities = await dbContext.DecisionRecords
            .AsNoTracking()
            .OrderByDescending(record => record.CreatedAt)
            .Take(boundedLimit)
            .ToListAsync(cancellationToken);

        return entities.Select(MapToDomain).ToArray();
    }

    private static DecisionRecordEntity MapToEntity(DecisionRecord record) =>
        new()
        {
            Id = record.Id,
            CreatedAt = record.CreatedAt,
            Symbol = record.Symbol,
            TradingMode = record.TradingMode,
            Recommendation = record.Recommendation,
            Direction = record.Direction,
            ConfidenceScore = record.ConfidenceScore,
            RequestJson = record.RequestJson,
            ResponseJson = record.ResponseJson
        };

    private static DecisionRecord MapToDomain(DecisionRecordEntity entity) =>
        DecisionRecord.FromPersistence(
            entity.Id,
            entity.CreatedAt,
            entity.Symbol,
            entity.TradingMode,
            entity.Recommendation,
            entity.Direction,
            entity.ConfidenceScore,
            entity.RequestJson,
            entity.ResponseJson);
}
