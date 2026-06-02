import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

function healthClass(health: string) {
  if (health === "HEALTHY") return "success";
  if (health === "FAILED") return "danger";
  if (health === "WARNING" || health === "STALE") return "warning";
  return "neutral";
}

export function ConfigurationCards({ cards }: { cards: SourceConfigurationDashboard["summaryCards"] }) {
  return (
    <section className="sc-summary-grid">
      {cards.map((card) => (
        <article key={card.sourceKey} className={`sc-summary-card ${healthClass(card.health)}`}>
          <small>{card.label}</small>
          <strong>{card.provider}</strong>
          <div className="sc-summary-meta">
            <span>Status <b>{card.status}</b></span>
            <span>Health <b>{card.health}</b></span>
            <span>Last Sync <b>{card.lastSync ? new Date(card.lastSync).toLocaleString() : "—"}</b></span>
            <span>Latency <b>{card.latency}</b></span>
            <span>Records <b>{card.records.toLocaleString()}</b></span>
          </div>
        </article>
      ))}
    </section>
  );
}
