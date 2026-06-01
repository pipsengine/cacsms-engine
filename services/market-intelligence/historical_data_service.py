"""Historical OHLCV ingestion, filtering, export and comparison boundary."""
from dataclasses import dataclass

@dataclass
class HistoricalDataService:
    repository: object
    audit: object

    def query(self, asset_class=None, instrument=None, timeframe="1D", start_date=None, end_date=None, source=None):
        return self.repository.query(asset_class=asset_class, instrument=instrument, timeframe=timeframe, start_date=start_date, end_date=end_date, source=source)

    def sync(self, provider, triggered_by="MANUAL"):
        result = provider.sync()
        self.audit.log_sync(provider=provider.name, triggered_by=triggered_by, result=result)
        return result

    def upload(self, csv_file, source="MANUAL_UPLOAD"):
        return self.repository.import_csv(csv_file, source=source)

    def export(self, records, output_format="csv"):
        return self.repository.export(records, output_format=output_format)
