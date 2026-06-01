"""Latest-report date, stale-cycle, duplicate and batch validation."""
from datetime import date, timedelta

class CotValidationService:
    def validate_latest(self, latest_report_date):
        report_date = date.fromisoformat(latest_report_date)
        age_days = (date.today() - report_date).days
        return {"latest_report_date": latest_report_date, "age_days": age_days, "status": "STALE" if age_days > 14 else "VALID", "warning": age_days > 7}
