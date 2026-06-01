"""CFTC Futures Only COT synchronization orchestration boundary."""
from dataclasses import dataclass

@dataclass
class CotSyncService:
    downloader: object
    parser: object
    mapper: object
    bias_service: object
    repository: object
    audit: object

    def sync_latest(self, triggered_by="MANUAL", attempt=1):
        raw_file = self.downloader.download_latest_futures_only()
        records = self.parser.parse(raw_file)
        mapped = self.mapper.filter_target_currencies(records)
        scored = [self.bias_service.score(record) for record in mapped]
        result = self.repository.upsert_positions(scored)
        self.audit.log_sync(triggered_by=triggered_by, attempt=attempt, result=result)
        return result
