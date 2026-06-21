using System.Collections.Concurrent;
using Cacsms.Engine.Domain.Abstractions;

namespace Cacsms.Engine.Infrastructure.Persistence;

public sealed class InMemoryRepository<TAggregate> : IRepository<TAggregate>
    where TAggregate : AggregateRoot
{
    private readonly ConcurrentDictionary<Guid, TAggregate> _store = new();

    public Task<TAggregate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _store.TryGetValue(id, out var aggregate);
        return Task.FromResult(aggregate);
    }

    public Task<IReadOnlyCollection<TAggregate>> ListAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyCollection<TAggregate>>(_store.Values.ToArray());
    }

    public Task AddAsync(TAggregate aggregate, CancellationToken cancellationToken = default)
    {
        _store[aggregate.Id] = aggregate;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(TAggregate aggregate, CancellationToken cancellationToken = default)
    {
        _store[aggregate.Id] = aggregate;
        return Task.CompletedTask;
    }
}
