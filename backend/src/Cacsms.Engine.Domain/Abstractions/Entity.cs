namespace Cacsms.Engine.Domain.Abstractions;

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; protected init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; protected set; }

    protected void MarkUpdated() => UpdatedAt = DateTimeOffset.UtcNow;
}
