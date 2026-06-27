namespace Cacsms.Engine.Infrastructure.Persistence.Entities;

public sealed class CotPositioningSnapshotEntity
{
    public Guid Id { get; set; }

    public DateOnly ReportDate { get; set; }

    public DateOnly ReleaseDate { get; set; }

    public string ReportingPeriod { get; set; } = string.Empty;

    public string DataSource { get; set; } = string.Empty;

    public string Server { get; set; } = string.Empty;

    public string ServerStatus { get; set; } = string.Empty;

    public int NetPositionAll { get; set; }

    public int TotalLong { get; set; }

    public int TotalShort { get; set; }

    public decimal LongShortRatio { get; set; }

    public int TotalTraders { get; set; }

    public int OpenInterest { get; set; }

    public int TotalContracts { get; set; }

    public int NonCommercialNet { get; set; }

    public int CommercialNet { get; set; }

    public int NonReportableNet { get; set; }

    public string Bias { get; set; } = string.Empty;

    public string InstitutionalSentiment { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<CotPositioningRowEntity> Rows { get; set; } = [];
}
