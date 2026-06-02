"use client";

import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  jobs: SourceConfigurationDashboard["syncJobs"];
  onSyncNow: () => void;
  onRetryFailed: () => void;
  onForceRefresh: () => void;
  busy?: boolean;
};

export function SynchronizationCenter({ jobs, onSyncNow, onRetryFailed, onForceRefresh, busy }: Props) {
  return (
    <section className="sc-panel">
      <div className="sc-panel-head">
        <h2>Synchronization Center</h2>
        <div className="sc-inline-actions">
          <button className="sc-button primary" disabled={busy} onClick={onSyncNow}>Sync Now</button>
          <button className="sc-button secondary" disabled={busy} onClick={onRetryFailed}>Retry Failed</button>
          <button className="sc-button secondary" disabled={busy} onClick={onForceRefresh}>Force Refresh</button>
        </div>
      </div>
      <div className="sc-table-wrap">
        <table>
          <thead><tr><th>Source</th><th>Last Sync</th><th>Next Sync</th><th>Records Imported</th><th>Sync Duration</th><th>Status</th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.sourceLabel}</td>
                <td>{job.lastSyncAt ? new Date(job.lastSyncAt).toLocaleString() : "—"}</td>
                <td>{job.nextSyncAt ? new Date(job.nextSyncAt).toLocaleString() : job.schedule}</td>
                <td>{job.recordsImported.toLocaleString()}</td>
                <td>{job.syncDurationMs ? `${job.syncDurationMs} ms` : "—"}</td>
                <td>{job.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
