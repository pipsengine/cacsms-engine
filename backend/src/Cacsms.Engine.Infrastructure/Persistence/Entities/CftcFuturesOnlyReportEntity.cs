namespace Cacsms.Engine.Infrastructure.Persistence.Entities;

public sealed class CftcFuturesOnlyReportEntity
{
    public Guid Id { get; set; }

    public DateOnly ReportDate { get; set; }

    public int ReportYear { get; set; }

    public string MarketName { get; set; } = string.Empty;

    public string ContractMarketCode { get; set; } = string.Empty;

    public string MarketCode { get; set; } = string.Empty;

    public string CommodityCode { get; set; } = string.Empty;

    public int OpenInterest { get; set; }

    public int NonCommercialLong { get; set; }

    public int NonCommercialShort { get; set; }

    public int NonCommercialSpreading { get; set; }

    public int CommercialLong { get; set; }

    public int CommercialShort { get; set; }

    public int NonReportableLong { get; set; }

    public int NonReportableShort { get; set; }

    public int ChangeOpenInterest { get; set; }

    public int ChangeNonCommercialLong { get; set; }

    public int ChangeNonCommercialShort { get; set; }

    public int ChangeCommercialLong { get; set; }

    public int ChangeCommercialShort { get; set; }

    public int TotalTraders { get; set; }

    public string ContractUnits { get; set; } = string.Empty;

    public string SourceUrl { get; set; } = string.Empty;

    public DateTimeOffset SyncedAt { get; set; }
}
