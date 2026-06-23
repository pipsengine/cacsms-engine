namespace Cacsms.Engine.Application.Intelligence;

public interface ICurrencyStrengthIntelligenceService
{
    CurrencyStrengthSnapshotDto GetLatest();

    CurrencyStrengthSnapshotDto Ingest(CurrencyStrengthIngestRequest request);

    CurrencyStrengthEnrichmentResult EnrichForSymbol(string symbol);
}
