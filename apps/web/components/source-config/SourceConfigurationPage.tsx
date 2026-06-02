"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionCenter } from "./ActionCenter";
import { AuditLogsPanel } from "./AuditLogsPanel";
import { ConfigurationCards } from "./ConfigurationCards";
import { ConnectionTestingCenter } from "./ConnectionTestingCenter";
import { ConnectivityBanner } from "./ConnectivityBanner";
import { CredentialVaultPanel } from "./CredentialVaultPanel";
import { Header } from "./Header";
import { HealthMonitoringCenter } from "./HealthMonitoringCenter";
import { ProviderConfigurationPanel } from "./ProviderConfigurationPanel";
import { SourceRegistry } from "./SourceRegistry";
import { SynchronizationCenter } from "./SynchronizationCenter";
import { WorkflowDependencyMap } from "./WorkflowDependencyMap";
import {
  API_BASE,
  fetchSourceConfiguration,
  postSourceAction,
  type SourceConfigurationDashboard
} from "../../lib/source-config/types";

export function SourceConfigurationPage() {
  const [data, setData] = useState<SourceConfigurationDashboard>();
  const [health, setHealth] = useState<Array<{
    sourceKey: string;
    source: string;
    health: string;
    freshness: string;
    latencyMs: number | null;
    availability: string;
  }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const logsRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const payload = await fetchSourceConfiguration();
    setData(payload);
    setSelectedId((current) => current || payload.registry[0]?.id || null);
    const healthResponse = await fetch(`${API_BASE}/api/source-configuration/health`, { cache: "no-store" });
    if (healthResponse.ok) {
      const healthPayload = await healthResponse.json();
      setHealth(healthPayload.sources || []);
    }
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const updateProvider = async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE}/api/source-configuration/provider/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!response.ok) throw new Error(`Provider update failed (${response.status})`);
  };

  if (error && !data) {
    return (
      <main className="sc-dashboard">
        <section className="sc-panel"><h1>Source Configuration Center</h1><p>{error}</p><button className="sc-button primary" onClick={() => load()}>Retry</button></section>
      </main>
    );
  }

  if (!data) {
    return <main className="sc-dashboard"><section className="sc-panel"><h1>Source Configuration Center</h1><p>Loading master connectivity registry...</p></section></main>;
  }

  return (
    <main className="sc-dashboard">
      <Header
        data={data.header}
        busy={busy}
        onAddProvider={() => run(async () => {
          await fetch(`${API_BASE}/api/source-configuration/provider`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceKey: "market-data", providerName: "Custom Feed" })
          });
        })}
        onTestAll={() => run(async () => { await postSourceAction("/api/source-configuration/test-all"); })}
        onSyncAll={() => run(async () => { await postSourceAction("/api/source-configuration/sync-all"); })}
        onExport={() => run(async () => {
          const payload = await fetch(`${API_BASE}/api/source-configuration/export`).then((response) => response.json());
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "source-configuration-export.json";
          anchor.click();
          URL.revokeObjectURL(url);
        })}
      />
      {error ? <p className="sc-error">{error}</p> : null}
      <ConnectivityBanner data={data.connectivity} />
      <ConfigurationCards cards={data.summaryCards} />
      <SourceRegistry
        registry={data.registry}
        busy={busy}
        onConfigure={setSelectedId}
        onTest={(id) => run(async () => { await postSourceAction("/api/source-configuration/test", { providerId: id }); })}
        onSync={(id) => run(async () => { await postSourceAction("/api/source-configuration/sync", { providerId: id }); })}
        onDisable={(id) => run(async () => {
          const row = data.registry.find((item) => item.id === id);
          if (row) await updateProvider(id, { enabled: !row.enabled });
        })}
      />
      <ProviderConfigurationPanel
        categories={data.categories}
        registry={data.registry}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="sc-grid-2">
        <ConnectionTestingCenter
          results={data.testResults}
          busy={busy}
          onTestAll={() => run(async () => { await postSourceAction("/api/source-configuration/test-all"); })}
          onRunValidation={() => run(async () => { await postSourceAction("/api/market-intelligence/data-quality-gate/run"); })}
        />
        <HealthMonitoringCenter health={health} onRefresh={() => load().catch(() => undefined)} />
      </div>
      <SynchronizationCenter
        jobs={data.syncJobs}
        busy={busy}
        onSyncNow={() => run(async () => { await postSourceAction("/api/source-configuration/sync-all"); })}
        onRetryFailed={() => run(async () => {
          for (const job of data.syncJobs.filter((item) => item.status === "FAILED")) {
            const provider = data.registry.find((row) => row.sourceKey === job.sourceKey);
            if (provider) await postSourceAction("/api/source-configuration/sync", { providerId: provider.id });
          }
        })}
        onForceRefresh={() => run(async () => { await postSourceAction("/api/market-intelligence/data-sources/sync"); })}
      />
      <div className="sc-grid-2">
        <CredentialVaultPanel credentials={data.credentials} />
        <WorkflowDependencyMap dependencies={data.workflowDependencies} />
      </div>
      <section ref={logsRef}>
        <AuditLogsPanel logs={data.auditLogs} />
      </section>
      <ActionCenter
        busy={busy}
        onAddProvider={() => run(async () => {
          await fetch(`${API_BASE}/api/source-configuration/provider`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceKey: "market-data", providerName: "Custom Feed" })
          });
        })}
        onSave={() => run(async () => undefined)}
        onTestAll={() => run(async () => { await postSourceAction("/api/source-configuration/test-all"); })}
        onSyncAll={() => run(async () => { await postSourceAction("/api/source-configuration/sync-all"); })}
        onExport={() => run(async () => {
          const payload = await fetch(`${API_BASE}/api/source-configuration/export`).then((response) => response.json());
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "source-configuration-export.json";
          anchor.click();
          URL.revokeObjectURL(url);
        })}
        onImport={() => setError("Import requires validated operator upload pipeline.")}
        onOpenLogs={() => logsRef.current?.scrollIntoView({ behavior: "smooth" })}
      />
    </main>
  );
}
