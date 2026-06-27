using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cacsms.Engine.Infrastructure.Persistence.Configurations;

internal sealed class CotPositioningSnapshotEntityConfiguration : IEntityTypeConfiguration<CotPositioningSnapshotEntity>
{
    public void Configure(EntityTypeBuilder<CotPositioningSnapshotEntity> builder)
    {
        builder.ToTable("cot_positioning_snapshots");

        builder.HasKey(snapshot => snapshot.Id);

        builder.Property(snapshot => snapshot.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(snapshot => snapshot.ReportDate)
            .HasColumnName("report_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(snapshot => snapshot.ReleaseDate)
            .HasColumnName("release_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(snapshot => snapshot.ReportingPeriod)
            .HasColumnName("reporting_period")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(snapshot => snapshot.DataSource)
            .HasColumnName("data_source")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(snapshot => snapshot.Server)
            .HasColumnName("server")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(snapshot => snapshot.ServerStatus)
            .HasColumnName("server_status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(snapshot => snapshot.NetPositionAll).HasColumnName("net_position_all");
        builder.Property(snapshot => snapshot.TotalLong).HasColumnName("total_long");
        builder.Property(snapshot => snapshot.TotalShort).HasColumnName("total_short");
        builder.Property(snapshot => snapshot.LongShortRatio).HasColumnName("long_short_ratio").HasPrecision(8, 2);
        builder.Property(snapshot => snapshot.TotalTraders).HasColumnName("total_traders");
        builder.Property(snapshot => snapshot.OpenInterest).HasColumnName("open_interest");
        builder.Property(snapshot => snapshot.TotalContracts).HasColumnName("total_contracts");
        builder.Property(snapshot => snapshot.NonCommercialNet).HasColumnName("non_commercial_net");
        builder.Property(snapshot => snapshot.CommercialNet).HasColumnName("commercial_net");
        builder.Property(snapshot => snapshot.NonReportableNet).HasColumnName("non_reportable_net");

        builder.Property(snapshot => snapshot.Bias)
            .HasColumnName("bias")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(snapshot => snapshot.InstitutionalSentiment)
            .HasColumnName("institutional_sentiment")
            .HasMaxLength(160)
            .IsRequired();

        builder.Property(snapshot => snapshot.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(snapshot => snapshot.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(snapshot => new { snapshot.ReportDate, snapshot.DataSource })
            .IsUnique()
            .HasDatabaseName("ux_cot_positioning_snapshots_report_source");

        builder.HasIndex(snapshot => snapshot.ReportDate)
            .IsDescending()
            .HasDatabaseName("ix_cot_positioning_snapshots_report_date");
    }
}
