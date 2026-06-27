using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cacsms.Engine.Infrastructure.Persistence.Configurations;

internal sealed class DecisionRecordEntityConfiguration : IEntityTypeConfiguration<DecisionRecordEntity>
{
    public void Configure(EntityTypeBuilder<DecisionRecordEntity> builder)
    {
        builder.ToTable("decision_records");

        builder.HasKey(record => record.Id);

        builder.Property(record => record.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(record => record.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(record => record.Symbol)
            .HasColumnName("symbol")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(record => record.TradingMode)
            .HasColumnName("trading_mode")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(record => record.Recommendation)
            .HasColumnName("recommendation")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(record => record.Direction)
            .HasColumnName("direction")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(record => record.ConfidenceScore)
            .HasColumnName("confidence_score")
            .HasPrecision(5, 2)
            .IsRequired();

        builder.Property(record => record.RequestJson)
            .HasColumnName("request_json")
            .IsRequired();

        builder.Property(record => record.ResponseJson)
            .HasColumnName("response_json")
            .IsRequired();

        builder.HasIndex(record => record.CreatedAt)
            .IsDescending()
            .HasDatabaseName("ix_decision_records_created_at");
    }
}
