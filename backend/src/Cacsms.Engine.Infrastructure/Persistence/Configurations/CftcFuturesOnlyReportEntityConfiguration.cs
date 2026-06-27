using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cacsms.Engine.Infrastructure.Persistence.Configurations;

internal sealed class CftcFuturesOnlyReportEntityConfiguration : IEntityTypeConfiguration<CftcFuturesOnlyReportEntity>
{
    public void Configure(EntityTypeBuilder<CftcFuturesOnlyReportEntity> builder)
    {
        builder.ToTable("cftc_futures_only_reports");

        builder.HasKey(report => report.Id);

        builder.Property(report => report.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(report => report.ReportDate)
            .HasColumnName("report_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(report => report.ReportYear).HasColumnName("report_year").IsRequired();

        builder.Property(report => report.MarketName)
            .HasColumnName("market_name")
            .HasMaxLength(180)
            .IsRequired();

        builder.Property(report => report.ContractMarketCode)
            .HasColumnName("contract_market_code")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(report => report.MarketCode)
            .HasColumnName("market_code")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(report => report.CommodityCode)
            .HasColumnName("commodity_code")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(report => report.OpenInterest).HasColumnName("open_interest");
        builder.Property(report => report.NonCommercialLong).HasColumnName("non_commercial_long");
        builder.Property(report => report.NonCommercialShort).HasColumnName("non_commercial_short");
        builder.Property(report => report.NonCommercialSpreading).HasColumnName("non_commercial_spreading");
        builder.Property(report => report.CommercialLong).HasColumnName("commercial_long");
        builder.Property(report => report.CommercialShort).HasColumnName("commercial_short");
        builder.Property(report => report.NonReportableLong).HasColumnName("non_reportable_long");
        builder.Property(report => report.NonReportableShort).HasColumnName("non_reportable_short");
        builder.Property(report => report.ChangeOpenInterest).HasColumnName("change_open_interest");
        builder.Property(report => report.ChangeNonCommercialLong).HasColumnName("change_non_commercial_long");
        builder.Property(report => report.ChangeNonCommercialShort).HasColumnName("change_non_commercial_short");
        builder.Property(report => report.ChangeCommercialLong).HasColumnName("change_commercial_long");
        builder.Property(report => report.ChangeCommercialShort).HasColumnName("change_commercial_short");
        builder.Property(report => report.TotalTraders).HasColumnName("total_traders");

        builder.Property(report => report.ContractUnits)
            .HasColumnName("contract_units")
            .HasMaxLength(180)
            .IsRequired();

        builder.Property(report => report.SourceUrl)
            .HasColumnName("source_url")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(report => report.SyncedAt).HasColumnName("synced_at").IsRequired();

        builder.HasIndex(report => new { report.ReportDate, report.ContractMarketCode })
            .IsUnique()
            .HasDatabaseName("ux_cftc_futures_only_reports_date_contract");

        builder.HasIndex(report => report.ReportDate)
            .IsDescending()
            .HasDatabaseName("ix_cftc_futures_only_reports_report_date");
    }
}
