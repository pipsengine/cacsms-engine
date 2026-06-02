import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  categories: SourceConfigurationDashboard["categories"];
  registry: SourceConfigurationDashboard["registry"];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ProviderConfigurationPanel({ categories, registry, selectedId, onSelect }: Props) {
  const selected = registry.find((row) => row.id === selectedId) || registry[0];
  const category = categories.find((item) => item.id === selected?.sourceKey);

  return (
    <section className="sc-panel">
      <div className="sc-panel-head"><h2>Provider Configuration Panels</h2><b>{categories.length} SOURCE TYPES</b></div>
      <div className="sc-config-layout">
        <aside className="sc-config-nav">
          {registry.map((row) => (
            <button key={row.id} className={row.id === selected?.id ? "active" : ""} onClick={() => onSelect(row.id)}>
              {row.source}
            </button>
          ))}
        </aside>
        {selected ? (
          <div className="sc-config-form">
            <h3>{selected.source}</h3>
            <p>Supported providers: {category?.supportedProviders.join(", ")}</p>
            <div className="sc-form-grid">
              <label>Provider Name<input readOnly value={selected.provider} /></label>
              <label>Provider Type<input readOnly value={selected.providerType} /></label>
              <label>API URL<input readOnly value={selected.apiUrl || "—"} /></label>
              <label>WebSocket URL<input readOnly value={selected.websocketUrl || "—"} /></label>
              <label>Authentication Type<input readOnly value={selected.authentication} /></label>
              <label>Status<input readOnly value={selected.status} /></label>
              <label>Enabled<input readOnly value={selected.enabled ? "Yes" : "No"} /></label>
              <label>Environment<input readOnly value={selected.environment} /></label>
            </div>
            {selected.sourceKey === "institutional-cot" ? (
              <div className="sc-form-grid">
                <label>Report Type<input readOnly value={String(selected.config.reportType || "FUTURES_ONLY")} /></label>
                <label>Sync Schedule<input readOnly value={String(selected.config.syncSchedule || "Saturday 12:00am")} /></label>
                <label>Currency Mapping<input readOnly value={String(selected.config.currencyMapping || "CFTC Legacy")} /></label>
              </div>
            ) : null}
            {selected.sourceKey === "prop-firm-rules" ? (
              <div className="sc-form-grid">
                <label>Supported Firms<input readOnly value={Array.isArray(selected.config.supportedFirms) ? selected.config.supportedFirms.join(", ") : "FTMO, FundedNext, 5ers, E8, Custom"} /></label>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
