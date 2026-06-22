using Cacsms.Engine.Domain.Decisioning;

namespace Cacsms.Engine.Application.Abstractions;

public interface IDecisionRecordRepository
{
    Task AddAsync(DecisionRecord record, CancellationToken cancellationToken = default);
    Task<DecisionRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<DecisionRecord>> ListRecentAsync(int limit, CancellationToken cancellationToken = default);
}
