"use client";

type Props = {
  onAddProvider: () => void;
  onTestProvider: () => void;
  onTestAll: () => void;
  onSyncSymbols: () => void;
  onRefreshFeeds: () => void;
  onExport: () => void;
  onOpenLogs: () => void;
  busy?: boolean;
};

export function ActionCenter({ onAddProvider, onTestProvider, onTestAll, onSyncSymbols, onRefreshFeeds, onExport, onOpenLogs, busy }: Props) {
  const actions = [
    ["Add Provider", onAddProvider], ["Test Provider", onTestProvider], ["Test All", onTestAll], ["Sync Symbols", onSyncSymbols],
    ["Refresh Feeds", onRefreshFeeds], ["Export Status", onExport], ["Open Logs", onOpenLogs]
  ] as const;
  return (
    <section className="mdoc-panel mdoc-action-center">
      <div className="mdoc-panel-head"><h2>Action Center</h2><b>DESK CONTROLS</b></div>
      <div className="mdoc-action-grid">{actions.map(([label, action]) => <button key={label} className="mdoc-button secondary" disabled={busy} onClick={action}>{label}</button>)}</div>
    </section>
  );
}
