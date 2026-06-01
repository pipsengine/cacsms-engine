"""Weekly delayed-pull scheduler for CFTC Futures Only COT reports."""
import os
from datetime import datetime

COT_SYNC_JOB_NAME = "cot_weekly_sync_job"
COT_SYNC_CRON = "0 0 * * 6"
COT_SYNC_RETRIES = 3

def cot_weekly_sync_job(sync_service):
    """Pull after Friday's CFTC release window and retry transient failures."""
    if os.getenv("COT_SYNC_ENABLED", "true").lower() != "true":
        return {"job": COT_SYNC_JOB_NAME, "status": "DISABLED"}
    last_error = None
    for attempt in range(1, COT_SYNC_RETRIES + 1):
        try:
            return sync_service.sync_latest(triggered_by="SCHEDULER", attempt=attempt)
        except Exception as exc:  # provider boundary logs the concrete exception
            last_error = str(exc)
    return {"job": COT_SYNC_JOB_NAME, "status": "FAILED", "attempts": COT_SYNC_RETRIES, "error": last_error, "completed_at": datetime.utcnow().isoformat()}

def register_cot_scheduler(scheduler, sync_service):
    scheduler.add_job(cot_weekly_sync_job, "cron", id=COT_SYNC_JOB_NAME, day_of_week="sat", hour=0, minute=0, args=[sync_service], replace_existing=True)
