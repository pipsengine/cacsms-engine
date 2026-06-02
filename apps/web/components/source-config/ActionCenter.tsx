"use client";

type Props = {
  onAddProvider: () => void;
  onSave: () => void;
  onTestAll: () => void;
  onSyncAll: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenLogs: () => void;
  busy?: boolean;
};

export function ActionCenter({ onAddProvider, onSave, onTestAll, onSyncAll, onExport, onImport, onOpenLogs, busy }: Props) {
  const actions = [
    ["Add Provider", onAddProvider],
    ["Save Configuration", onSave],
    ["Test All", onTestAll],
    ["Sync All", onSyncAll],
    ["Export Config", onExport],
    ["Import Config", onImport],
    ["Open Logs", onOpenLogs]
  ] as const;

  return (
    <section className="sc-panel sc-action-center">
      <div className="sc-panel-head"><h2>Action Center</h2><b>OPERATOR CONTROLS</b></div>
      <div className="sc-action-grid">
        {actions.map(([label, action]) => (
          <button key={label} className="sc-button secondary" disabled={busy} onClick={action}>{label}</button>
        ))}
      </div>
    </section>
  );
}
