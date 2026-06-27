using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using Cacsms.Engine.Application.Intelligence;
using Cacsms.Engine.Infrastructure.Persistence;
using Cacsms.Engine.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class CftcCotPositioningSyncService : ICotPositioningSyncService
{
    private const string IndexUrl = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm";
    private static readonly Uri CftcRoot = new("https://www.cftc.gov");
    private static readonly Regex FuturesOnlyLinkPattern = new(
        "href=[\"'](?<href>[^\"']*/deacot(?<year>\\d{4})\\.zip)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly IReadOnlyDictionary<string, CotInstrumentDefinition> Instruments =
        new Dictionary<string, CotInstrumentDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["099741"] = new("EUR", "Euro", "EU", 1),
            ["096742"] = new("GBP", "British Pound", "GB", 2),
            ["097741"] = new("JPY", "Japanese Yen", "JP", 3),
            ["092741"] = new("CHF", "Swiss Franc", "CH", 4),
            ["090741"] = new("CAD", "Canadian Dollar", "CA", 5),
            ["232741"] = new("AUD", "Australian Dollar", "AU", 6),
            ["112741"] = new("NZD", "New Zealand Dollar", "NZ", 7),
            ["088691"] = new("XAU", "Gold", "XAU", 9)
        };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ICotPositioningService _positioningService;
    private readonly IDbContextFactory<CacsmsEngineDbContext> _dbContextFactory;
    private readonly ILogger<CftcCotPositioningSyncService> _logger;
    private readonly SemaphoreSlim _syncLock = new(1, 1);

    public CftcCotPositioningSyncService(
        IHttpClientFactory httpClientFactory,
        ICotPositioningService positioningService,
        IDbContextFactory<CacsmsEngineDbContext> dbContextFactory,
        ILogger<CftcCotPositioningSyncService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _positioningService = positioningService;
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public CotPositioningSyncResultDto? LastResult { get; private set; }

    public async Task<CotPositioningSyncResultDto> SyncLastTwoYearsAsync(CancellationToken cancellationToken = default)
    {
        if (!await _syncLock.WaitAsync(0, cancellationToken))
        {
            return LastResult ?? new CotPositioningSyncResultDto(
                DateTimeOffset.UtcNow,
                DateTimeOffset.UtcNow,
                DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-2)),
                0,
                0,
                0,
                IndexUrl,
                "AlreadyRunning",
                "A CFTC COT sync is already running.");
        }

        var startedAt = DateTimeOffset.UtcNow;
        var cutoffDate = DateOnly.FromDateTime(startedAt.UtcDateTime.Date.AddYears(-2));

        try
        {
            var yearlyLinks = await GetFuturesOnlyLinksAsync(cancellationToken);
            var requestedYears = Enumerable.Range(cutoffDate.Year, startedAt.Year - cutoffDate.Year + 1)
                .Where(yearlyLinks.ContainsKey)
                .OrderBy(year => year)
                .ToArray();

            var rowsByDate = new Dictionary<DateOnly, List<CftcCotRow>>();
            var rawRows = new List<CftcFuturesOnlyReportEntity>();

            foreach (var year in requestedYears)
            {
                var annualRows = await DownloadAnnualRowsAsync(year, yearlyLinks[year], cutoffDate, startedAt, cancellationToken);
                rawRows.AddRange(annualRows.RawRows);

                foreach (var row in annualRows.PositioningRows)
                {
                    if (!rowsByDate.TryGetValue(row.ReportDate, out var dateRows))
                    {
                        dateRows = [];
                        rowsByDate[row.ReportDate] = dateRows;
                    }

                    dateRows.RemoveAll(existing => existing.Symbol.Equals(row.Symbol, StringComparison.OrdinalIgnoreCase));
                    dateRows.Add(row);
                }
            }

            AddUsdAggregateRows(rowsByDate);

            await ReplaceRawRowsAsync(rawRows, cutoffDate, cancellationToken);

            var snapshots = 0;
            var rowCount = 0;

            foreach (var dateGroup in rowsByDate.OrderBy(item => item.Key))
            {
                var rows = dateGroup.Value
                    .OrderBy(row => row.Order)
                    .Select(row => new CotPositioningRowDto(
                        row.ReportDate,
                        row.Symbol,
                        row.CurrencyName,
                        row.DisplayCode,
                        row.NonCommercialLong,
                        -row.NonCommercialShort,
                        row.ChangeNonCommercialLong,
                        -row.ChangeNonCommercialShort,
                        CalculatePercentChange(row.ChangeNonCommercialLong, row.NonCommercialLong),
                        row.NetPosition,
                        GetBias(row.NetPosition)))
                    .ToArray();

                if (rows.Length == 0)
                {
                    continue;
                }

                var totals = dateGroup.Value;
                var nonCommercialNet = totals.Sum(row => row.NetPosition);
                var commercialNet = totals.Sum(row => row.CommercialLong - row.CommercialShort);
                var nonReportableNet = totals.Sum(row => row.NonReportableLong - row.NonReportableShort);
                var totalLong = totals.Sum(row => row.NonCommercialLong);
                var totalShort = totals.Sum(row => row.NonCommercialShort);
                var openInterest = totals.Sum(row => row.OpenInterest);
                var traders = totals.Sum(row => row.TotalTraders);
                var bias = GetBias(nonCommercialNet);

                await _positioningService.UpsertAsync(
                    new CotPositioningUpsertRequest(
                        dateGroup.Key,
                        dateGroup.Key.AddDays(3),
                        $"{dateGroup.Key.AddDays(-7):MMM d} - {dateGroup.Key:MMM d, yyyy}",
                        "CFTC Futures Only",
                        "London Server",
                        "Connected",
                        nonCommercialNet,
                        totalLong,
                        totalShort,
                        totalShort == 0 ? 0 : Math.Round((decimal)totalLong / totalShort, 2),
                        traders,
                        openInterest,
                        openInterest,
                        nonCommercialNet,
                        commercialNet,
                        nonReportableNet,
                        bias,
                        $"Institutional sentiment is {bias.ToLowerInvariant()}",
                        rows),
                    cancellationToken);

                snapshots++;
                rowCount += rows.Length;
            }

            LastResult = new CotPositioningSyncResultDto(
                startedAt,
                DateTimeOffset.UtcNow,
                cutoffDate,
                requestedYears.Length,
                snapshots,
                rowCount,
                IndexUrl,
                "Succeeded",
                $"Synced {rowCount:N0} Futures Only rows into {snapshots:N0} weekly snapshots.");

            return LastResult;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "CFTC COT Futures Only sync failed.");

            LastResult = new CotPositioningSyncResultDto(
                startedAt,
                DateTimeOffset.UtcNow,
                cutoffDate,
                0,
                0,
                0,
                IndexUrl,
                "Failed",
                exception.Message);

            return LastResult;
        }
        finally
        {
            _syncLock.Release();
        }
    }

    private async Task<Dictionary<int, Uri>> GetFuturesOnlyLinksAsync(CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient(nameof(CftcCotPositioningSyncService));
        using var response = await httpClient.GetAsync(IndexUrl, cancellationToken);
        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync(cancellationToken);
        var links = new Dictionary<int, Uri>();

        foreach (Match match in FuturesOnlyLinkPattern.Matches(html))
        {
            var year = int.Parse(match.Groups["year"].Value, CultureInfo.InvariantCulture);
            var href = match.Groups["href"].Value;
            links[year] = href.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? new Uri(href)
                : new Uri(CftcRoot, href);
        }

        return links;
    }

    private async Task<CftcAnnualRows> DownloadAnnualRowsAsync(
        int year,
        Uri zipUri,
        DateOnly cutoffDate,
        DateTimeOffset syncedAt,
        CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient(nameof(CftcCotPositioningSyncService));
        using var response = await httpClient.GetAsync(zipUri, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var memory = new MemoryStream();
        await body.CopyToAsync(memory, cancellationToken);
        memory.Position = 0;

        using var archive = new ZipArchive(memory, ZipArchiveMode.Read, leaveOpen: false);
        var entry = archive.Entries.FirstOrDefault(item => item.Name.EndsWith(".txt", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"CFTC archive {zipUri} did not contain a text file.");

        using var entryStream = entry.Open();
        using var reader = new StreamReader(entryStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);

        var headerLine = await reader.ReadLineAsync(cancellationToken)
            ?? throw new InvalidOperationException($"CFTC archive {zipUri} was empty.");
        var headers = SplitCsvLine(headerLine);
        var index = headers
            .Select((header, ordinal) => new { Header = header.Trim(), Ordinal = ordinal })
            .ToDictionary(item => item.Header, item => item.Ordinal, StringComparer.OrdinalIgnoreCase);

        var rawRows = new List<CftcFuturesOnlyReportEntity>();
        var positioningRows = new List<CftcCotRow>();

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var fields = SplitCsvLine(line);
            var contractCode = Get(fields, index, "CFTC Contract Market Code").Trim();

            var reportDate = DateOnly.ParseExact(
                Get(fields, index, "As of Date in Form YYYY-MM-DD").Trim(),
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture);

            if (reportDate < cutoffDate)
            {
                continue;
            }

            var rawRow = new CftcFuturesOnlyReportEntity
            {
                Id = Guid.NewGuid(),
                ReportDate = reportDate,
                ReportYear = year,
                MarketName = Get(fields, index, "Market and Exchange Names").Trim(),
                ContractMarketCode = contractCode,
                MarketCode = Get(fields, index, "CFTC Market Code in Initials").Trim(),
                CommodityCode = Get(fields, index, "CFTC Commodity Code").Trim(),
                OpenInterest = ParseInt(Get(fields, index, "Open Interest (All)")),
                NonCommercialLong = ParseInt(Get(fields, index, "Noncommercial Positions-Long (All)")),
                NonCommercialShort = ParseInt(Get(fields, index, "Noncommercial Positions-Short (All)")),
                NonCommercialSpreading = ParseInt(Get(fields, index, "Noncommercial Positions-Spreading (All)")),
                CommercialLong = ParseInt(Get(fields, index, "Commercial Positions-Long (All)")),
                CommercialShort = ParseInt(Get(fields, index, "Commercial Positions-Short (All)")),
                NonReportableLong = ParseInt(Get(fields, index, "Nonreportable Positions-Long (All)")),
                NonReportableShort = ParseInt(Get(fields, index, "Nonreportable Positions-Short (All)")),
                ChangeOpenInterest = ParseInt(Get(fields, index, "Change in Open Interest (All)")),
                ChangeNonCommercialLong = ParseInt(Get(fields, index, "Change in Noncommercial-Long (All)")),
                ChangeNonCommercialShort = ParseInt(Get(fields, index, "Change in Noncommercial-Short (All)")),
                ChangeCommercialLong = ParseInt(Get(fields, index, "Change in Commercial-Long (All)")),
                ChangeCommercialShort = ParseInt(Get(fields, index, "Change in Commercial-Short (All)")),
                TotalTraders = ParseInt(Get(fields, index, "Traders-Total (All)")),
                ContractUnits = Get(fields, index, "Contract Units").Trim(),
                SourceUrl = zipUri.ToString(),
                SyncedAt = syncedAt
            };

            rawRows.Add(rawRow);

            if (!Instruments.TryGetValue(contractCode, out var instrument))
            {
                continue;
            }

            positioningRows.Add(new CftcCotRow(
                reportDate,
                instrument.Symbol,
                instrument.CurrencyName,
                instrument.DisplayCode,
                instrument.Order,
                rawRow.OpenInterest,
                rawRow.NonCommercialLong,
                rawRow.NonCommercialShort,
                rawRow.ChangeNonCommercialLong,
                rawRow.ChangeNonCommercialShort,
                rawRow.CommercialLong,
                rawRow.CommercialShort,
                rawRow.NonReportableLong,
                rawRow.NonReportableShort,
                rawRow.TotalTraders));
        }

        return new CftcAnnualRows(rawRows, positioningRows);
    }

    private async Task ReplaceRawRowsAsync(
        IReadOnlyCollection<CftcFuturesOnlyReportEntity> rows,
        DateOnly cutoffDate,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
        {
            return;
        }

        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);

        await dbContext.CftcFuturesOnlyReports
            .Where(report => report.ReportDate >= cutoffDate)
            .ExecuteDeleteAsync(cancellationToken);

        dbContext.CftcFuturesOnlyReports.AddRange(rows);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string Get(IReadOnlyList<string> fields, IReadOnlyDictionary<string, int> index, string column)
    {
        if (!index.TryGetValue(column, out var ordinal) || ordinal >= fields.Count)
        {
            return "0";
        }

        return fields[ordinal];
    }

    private static int ParseInt(string value)
    {
        var normalized = value.Trim().Replace(",", string.Empty, StringComparison.Ordinal);

        return int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }

    private static decimal CalculatePercentChange(int change, int current)
    {
        var previous = current - change;

        return previous == 0
            ? 0
            : Math.Round((decimal)change / Math.Abs(previous) * 100m, 2);
    }

    private static string GetBias(int netPosition)
    {
        if (netPosition > 0)
        {
            return "Bullish";
        }

        return netPosition < 0 ? "Bearish" : "Neutral";
    }

    private static void AddUsdAggregateRows(IDictionary<DateOnly, List<CftcCotRow>> rowsByDate)
    {
        foreach (var dateRows in rowsByDate.Values)
        {
            var fxRows = dateRows
                .Where(row => row.Symbol is "EUR" or "GBP" or "JPY" or "CHF" or "CAD" or "AUD" or "NZD")
                .ToArray();

            if (fxRows.Length == 0)
            {
                continue;
            }

            dateRows.RemoveAll(row => row.Symbol.Equals("USD", StringComparison.OrdinalIgnoreCase));

            dateRows.Add(new CftcCotRow(
                fxRows[0].ReportDate,
                "USD",
                "US Dollar",
                "USD",
                8,
                fxRows.Sum(row => row.OpenInterest),
                fxRows.Sum(row => row.NonCommercialShort),
                fxRows.Sum(row => row.NonCommercialLong),
                -fxRows.Sum(row => row.ChangeNonCommercialShort),
                -fxRows.Sum(row => row.ChangeNonCommercialLong),
                fxRows.Sum(row => row.CommercialShort),
                fxRows.Sum(row => row.CommercialLong),
                fxRows.Sum(row => row.NonReportableShort),
                fxRows.Sum(row => row.NonReportableLong),
                fxRows.Sum(row => row.TotalTraders)));
        }
    }

    private static List<string> SplitCsvLine(string line)
    {
        var fields = new List<string>();
        var value = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];

            if (character == '"')
            {
                if (inQuotes && index + 1 < line.Length && line[index + 1] == '"')
                {
                    value.Append('"');
                    index++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (character == ',' && !inQuotes)
            {
                fields.Add(value.ToString());
                value.Clear();
                continue;
            }

            value.Append(character);
        }

        fields.Add(value.ToString());
        return fields;
    }

    private sealed record CotInstrumentDefinition(
        string Symbol,
        string CurrencyName,
        string DisplayCode,
        int Order);

    private sealed record CftcAnnualRows(
        IReadOnlyCollection<CftcFuturesOnlyReportEntity> RawRows,
        IReadOnlyCollection<CftcCotRow> PositioningRows);

    private sealed record CftcCotRow(
        DateOnly ReportDate,
        string Symbol,
        string CurrencyName,
        string DisplayCode,
        int Order,
        int OpenInterest,
        int NonCommercialLong,
        int NonCommercialShort,
        int ChangeNonCommercialLong,
        int ChangeNonCommercialShort,
        int CommercialLong,
        int CommercialShort,
        int NonReportableLong,
        int NonReportableShort,
        int TotalTraders)
    {
        public int NetPosition => NonCommercialLong - NonCommercialShort;
    }
}
