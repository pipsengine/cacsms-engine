"use client";

type Props = {
  onAddProvider: () => void;
  onOpenSourceConfig: () => void;
};

export function EmptyState({ onAddProvider, onOpenSourceConfig }: Props) {
  return (
    <section className="mdoc-panel mdoc-empty">
      <h2>No market data providers configured yet.</h2>
      <p>Connect live pricing gateways through PostgreSQL-backed provider records. No sample rows are shown until providers are saved.</p>
      <div className="mdoc-header-actions">
        <button className="mdoc-button primary" onClick={onAddProvider}>Add Provider</button>
        <button className="mdoc-button secondary" onClick={onOpenSourceConfig}>Open Source Configuration Center</button>
      </div>
    </section>
  );
}
