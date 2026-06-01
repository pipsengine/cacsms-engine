"""COT synchronization and workflow-impact audit boundary."""
class CotAuditService:
    def __init__(self, repository):
        self.repository = repository

    def log_sync(self, **payload):
        return self.repository.create_sync_log(payload)
