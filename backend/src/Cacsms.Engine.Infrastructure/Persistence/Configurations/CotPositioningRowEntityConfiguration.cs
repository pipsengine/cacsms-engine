using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cacsms.Engine.Infrastructure.Persistence.Configurations;

internal sealed class CotPositioningRowEntityConfiguration : IEntityTypeConfiguration<CotPositioningRowEntity>
{
    public void Configure(EntityTypeBuilder<CotPositioningRowEntity> builder)
    {
        builder.ToTable("cot_positioning_rows");

        builder.HasKey(row => row.Id);

        builder.Property(row => row.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(row => row.SnapshotId).HasColumnName("snapshot_id").IsRequired();

        builder.Property(row => row.Date)
            .HasColumnName("date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(row => row.Symbol)
            .HasColumnName("symbol")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(row => row.CurrencyName)
            .HasColumnName("currency_name")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(row => row.DisplayCode)
            .HasColumnName("display_code")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(row => row.Long).HasColumnName("long");
        builder.Property(row => row.Short).HasColumnName("short");
        builder.Property(row => row.ChangeLong).HasColumnName("change_long");
        builder.Property(row => row.ChangeShort).HasColumnName("change_short");
        builder.Property(row => row.PercentChange).HasColumnName("percent_change").HasPrecision(8, 2);
        builder.Property(row => row.NetPositions).HasColumnName("net_positions");

        builder.Property(row => row.Bias)
            .HasColumnName("bias")
            .HasMaxLength(32)
            .IsRequired();

        builder.HasOne(row => row.Snapshot)
            .WithMany(snapshot => snapshot.Rows)
            .HasForeignKey(row => row.SnapshotId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(row => new { row.SnapshotId, row.Symbol })
            .IsUnique()
            .HasDatabaseName("ux_cot_positioning_rows_snapshot_symbol");
    }
}
