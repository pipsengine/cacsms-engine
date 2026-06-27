using Cacsms.Engine.Application.Intelligence;
using Cacsms.Engine.Infrastructure.Persistence;
using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class CotPositioningService : ICotPositioningService
{
    private readonly IDbContextFactory<CacsmsEngineDbContext> _dbContextFactory;

    public CotPositioningService(IDbContextFactory<CacsmsEngineDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    public async Task<CotPositioningSnapshotDto> GetLatestAsync(CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var snapshot = await dbContext.CotPositioningSnapshots
            .AsNoTracking()
            .Include(item => item.Rows)
            .OrderByDescending(item => item.ReportDate)
            .ThenByDescending(item => item.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (snapshot is not null)
        {
            return MapToDto(snapshot);
        }

        throw new InvalidOperationException("No CFTC COT positioning snapshots are available. Run the CFTC Futures Only sync first.");
    }

    public async Task<CotPositioningSnapshotDto?> GetByDateAsync(
        DateOnly reportDate,
        CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var snapshot = await dbContext.CotPositioningSnapshots
            .AsNoTracking()
            .Include(item => item.Rows)
            .Where(item => item.DataSource == "CFTC Futures Only" && item.ReportDate == reportDate)
            .OrderByDescending(item => item.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return snapshot is null ? null : MapToDto(snapshot);
    }

    public async Task<IReadOnlyCollection<DateOnly>> GetAvailableReportDatesAsync(CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        return await dbContext.CotPositioningSnapshots
            .AsNoTracking()
            .Where(item => item.DataSource == "CFTC Futures Only")
            .OrderByDescending(item => item.ReportDate)
            .Select(item => item.ReportDate)
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<CotPositioningRowDto>> GetHistoryAsync(
        string? symbol = null,
        string? exchange = null,
        CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var normalizedSymbol = NormalizeSymbol(symbol);
        var query = dbContext.CotPositioningRows
            .AsNoTracking()
            .Where(row => row.Snapshot != null && row.Snapshot.DataSource == "CFTC Futures Only");

        if (normalizedSymbol is not null)
        {
            query = query.Where(row => row.Symbol == normalizedSymbol);
        }

        var normalizedExchange = NormalizeExchange(exchange);
        if (normalizedExchange is not null)
        {
            query = normalizedExchange switch
            {
                "CME" => query.Where(row => row.Symbol != "XAU"),
                "COMEX" => query.Where(row => row.Symbol == "XAU"),
                _ => query
            };
        }

        var rows = await query
            .OrderByDescending(row => row.Date)
            .Select(row => new CotPositioningRowDto(
                row.Date,
                row.Symbol,
                row.CurrencyName,
                row.DisplayCode,
                ResolveExchange(row.Symbol),
                row.Symbol == "USD",
                row.Long,
                row.Short,
                row.ChangeLong,
                row.ChangeShort,
                row.PercentChange,
                row.NetPositions,
                row.Bias))
            .ToArrayAsync(cancellationToken);

        return rows
            .OrderByDescending(row => row.Date)
            .ThenBy(row => InstrumentOrder(row.Symbol))
            .ToArray();
    }

    public async Task<CotPositioningSnapshotDto> UpsertAsync(
        CotPositioningUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Rows.Count == 0)
        {
            throw new InvalidOperationException("At least one COT positioning row is required.");
        }

        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        var existing = await dbContext.CotPositioningSnapshots
            .Include(item => item.Rows)
            .FirstOrDefaultAsync(
                item => item.ReportDate == request.ReportDate && item.DataSource == Normalize(request.DataSource, "CFTC"),
                cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var snapshot = existing ?? new CotPositioningSnapshotEntity
        {
            Id = Guid.NewGuid(),
            CreatedAt = now
        };

        snapshot.ReportDate = request.ReportDate;
        snapshot.ReleaseDate = request.ReleaseDate;
        snapshot.ReportingPeriod = Normalize(request.ReportingPeriod, "May 7 - May 14, 2024");
        snapshot.DataSource = Normalize(request.DataSource, "CFTC");
        snapshot.Server = Normalize(request.Server, "London Server");
        snapshot.ServerStatus = Normalize(request.ServerStatus, "Connected");
        snapshot.NetPositionAll = request.NetPositionAll;
        snapshot.TotalLong = request.TotalLong;
        snapshot.TotalShort = request.TotalShort;
        snapshot.LongShortRatio = request.LongShortRatio;
        snapshot.TotalTraders = request.TotalTraders;
        snapshot.OpenInterest = request.OpenInterest;
        snapshot.TotalContracts = request.TotalContracts;
        snapshot.NonCommercialNet = request.NonCommercialNet;
        snapshot.CommercialNet = request.CommercialNet;
        snapshot.NonReportableNet = request.NonReportableNet;
        snapshot.Bias = Normalize(request.Bias, "Bullish");
        snapshot.InstitutionalSentiment = Normalize(request.InstitutionalSentiment, "Institutional sentiment is bullish");
        snapshot.UpdatedAt = now;

        if (existing is null)
        {
            dbContext.CotPositioningSnapshots.Add(snapshot);
        }
        else
        {
            dbContext.CotPositioningRows.RemoveRange(snapshot.Rows);
            snapshot.Rows.Clear();
        }

        foreach (var row in request.Rows)
        {
            snapshot.Rows.Add(new CotPositioningRowEntity
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshot.Id,
                Date = row.Date,
                Symbol = Normalize(row.Symbol, "UNKNOWN"),
                CurrencyName = Normalize(row.CurrencyName, row.Symbol),
                DisplayCode = Normalize(row.DisplayCode, row.Symbol),
                Long = row.Long,
                Short = row.Short,
                ChangeLong = row.ChangeLong,
                ChangeShort = row.ChangeShort,
                PercentChange = row.PercentChange,
                NetPositions = row.NetPositions,
                Bias = Normalize(row.Bias, "Neutral")
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(snapshot);
    }

    private static CotPositioningSnapshotDto MapToDto(CotPositioningSnapshotEntity snapshot) =>
        new(
            snapshot.Id,
            snapshot.ReportDate,
            snapshot.ReleaseDate,
            snapshot.ReportingPeriod,
            snapshot.DataSource,
            snapshot.Server,
            snapshot.ServerStatus,
            snapshot.NetPositionAll,
            snapshot.TotalLong,
            snapshot.TotalShort,
            snapshot.LongShortRatio,
            snapshot.TotalTraders,
            snapshot.OpenInterest,
            snapshot.TotalContracts,
            snapshot.NonCommercialNet,
            snapshot.CommercialNet,
            snapshot.NonReportableNet,
            snapshot.Bias,
            snapshot.InstitutionalSentiment,
            snapshot.Rows
                .OrderBy(row => InstrumentOrder(row.Symbol))
                .Select(row => new CotPositioningRowDto(
                    row.Date,
                    row.Symbol,
                    row.CurrencyName,
                    row.DisplayCode,
                    ResolveExchange(row.Symbol),
                    row.Symbol == "USD",
                    row.Long,
                    row.Short,
                    row.ChangeLong,
                    row.ChangeShort,
                    row.PercentChange,
                    row.NetPositions,
                    row.Bias))
                .ToArray());

    private static int InstrumentOrder(string symbol) =>
        symbol.ToUpperInvariant() switch
        {
            "EUR" => 1,
            "GBP" => 2,
            "JPY" => 3,
            "CHF" => 4,
            "CAD" => 5,
            "AUD" => 6,
            "NZD" => 7,
            "USD" => 8,
            "DXY" => 8,
            "XAU" => 9,
            _ => 99
        };

    private static string Normalize(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string? NormalizeSymbol(string? value) =>
        string.IsNullOrWhiteSpace(value) || value.Equals("ALL", StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim().ToUpperInvariant();

    private static string? NormalizeExchange(string? value) =>
        string.IsNullOrWhiteSpace(value) || value.Equals("All Exchanges", StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim().ToUpperInvariant();

    private static string ResolveExchange(string symbol) =>
        symbol.Equals("XAU", StringComparison.OrdinalIgnoreCase) ? "COMEX" : "CME";
}
