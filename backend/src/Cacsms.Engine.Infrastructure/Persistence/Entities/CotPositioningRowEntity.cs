namespace Cacsms.Engine.Infrastructure.Persistence.Entities;

public sealed class CotPositioningRowEntity
{
    public Guid Id { get; set; }

    public Guid SnapshotId { get; set; }

    public CotPositioningSnapshotEntity? Snapshot { get; set; }

    public DateOnly Date { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string CurrencyName { get; set; } = string.Empty;

    public string DisplayCode { get; set; } = string.Empty;

    public int Long { get; set; }

    public int Short { get; set; }

    public int ChangeLong { get; set; }

    public int ChangeShort { get; set; }

    public decimal PercentChange { get; set; }

    public int NetPositions { get; set; }

    public string Bias { get; set; } = string.Empty;
}
