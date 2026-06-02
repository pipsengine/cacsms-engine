import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

export function ConnectivityBanner({ data }: { data: SourceConfigurationDashboard["connectivity"] }) {
  const items = [
    ["Total Sources", data.totalSources],
    ["Configured", data.configuredSources],
    ["Healthy", data.healthySources],
    ["Failed", data.failedSources],
    ["Readiness", data.workflowReadiness],
    ["Health Score", `${data.configurationHealthScore}%`]
  ];

  return (
    <section className="sc-connectivity-banner">
      {items.map(([label, value]) => (
        <article key={label} className={label === "Readiness" && value === "RESTRICTED" ? "warning" : label === "Failed" && Number(value) > 0 ? "danger" : ""}>
          <small>{label}</small>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
