"use client";

import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  results: SourceConfigurationDashboard["testResults"];
  onTestAll: () => void;
  onRunValidation: () => void;
  busy?: boolean;
};

function resultClass(result: string) {
  if (result === "PASS") return "success";
  if (result === "WARNING") return "warning";
  return "danger";
}

export function ConnectionTestingCenter({ results, onTestAll, onRunValidation, busy }: Props) {
  return (
    <section className="sc-panel">
      <div className="sc-panel-head">
        <h2>Connection Testing Center</h2>
        <div className="sc-inline-actions">
          <button className="sc-button primary" disabled={busy} onClick={onTestAll}>Test All Sources</button>
          <button className="sc-button secondary" disabled={busy} onClick={onRunValidation}>Run Validation</button>
        </div>
      </div>
      <div className="sc-table-wrap">
        <table>
          <thead><tr><th>Source</th><th>Result</th><th>Latency</th><th>Details</th><th>Tested At</th></tr></thead>
          <tbody>
            {results.length ? results.map((row, index) => (
              <tr key={`${row.sourceKey}-${index}`}>
                <td>{row.source}</td>
                <td><b className={`sc-result ${resultClass(row.result)}`}>{row.result}</b></td>
                <td>{row.latencyMs != null ? `${row.latencyMs} ms` : "—"}</td>
                <td>{row.details}</td>
                <td>{row.testedAt ? new Date(row.testedAt).toLocaleString() : "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={5}>No connection tests recorded yet. Run Test All Sources to populate results.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
