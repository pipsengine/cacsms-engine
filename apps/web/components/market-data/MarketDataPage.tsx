"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionCenter } from "./ActionCenter";
import { AssetCoverageMatrix } from "./AssetCoverageMatrix";
import { DataIntegrityEngine } from "./DataIntegrityEngine";
import { EmptyState } from "./EmptyState";
import { Header } from "./Header";
import { KpiCards } from "./KpiCards";
import { LatencyMonitor } from "./LatencyMonitor";
import { LiveFeedMonitor } from "./LiveFeedMonitor";
import { LogsDrawer } from "./LogsDrawer";
import { MarketDataLogs } from "./MarketDataLogs";
import { ProviderComparisonCenter } from "./ProviderComparisonCenter";
import { ProviderDetailsDrawer } from "./ProviderDetailsDrawer";
import { ProviderFormModal } from "./ProviderFormModal";
import { ProviderRegistry } from "./ProviderRegistry";
import { SpreadQualityCenter } from "./SpreadQualityCenter";
import { StatusBanner } from "./StatusBanner";
import { SymbolAvailabilityMatrix } from "./SymbolAvailabilityMatrix";
import { TickQualityMonitor } from "./TickQualityMonitor";
import { WorkflowImpactPanel } from "./WorkflowImpactPanel";
import {
  useCreateMarketDataProvider,
  useDeleteMarketDataProvider,
  useDisableMarketDataProvider,
  useEnableMarketDataProvider,
  useExportMarketDataStatus,
  useMarketDataLogs,
  useMarketDataProviderDetails,
  useMarketDataProviders,
  useSyncAllMarketDataSymbols,
  useSyncMarketDataProviderSymbols,
  useTestAllMarketDataProviders,
  useTestMarketDataProvider,
  useUpdateMarketDataProvider
} from "../../lib/market-data/hooks";
import type { MarketDataProvider, ProviderFormValues } from "../../lib/market-data/types";

export function MarketDataPage() {
  const router = useRouter();
  const providersQuery = useMarketDataProviders();
  const logsQuery = useMarketDataLogs();
  const createProvider = useCreateMarketDataProvider();
  const updateProvider = useUpdateMarketDataProvider();
  const deleteProvider = useDeleteMarketDataProvider();
  const testProvider = useTestMarketDataProvider();
  const testAllProviders = useTestAllMarketDataProviders();
  const syncProviderSymbols = useSyncMarketDataProviderSymbols();
  const syncAllSymbols = useSyncAllMarketDataSymbols();
  const enableProvider = useEnableMarketDataProvider();
  const disableProvider = useDisableMarketDataProvider();
  const exportStatus = useExportMarketDataStatus();

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<MarketDataProvider | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const detailsQuery = useMarketDataProviderDetails(detailsId);
  const data = providersQuery.data;
  const logs = logsQuery.data?.logs || data?.logs || [];
  const busy = providersQuery.isFetching || createProvider.isPending || updateProvider.isPending || deleteProvider.isPending
    || testProvider.isPending || testAllProviders.isPending || syncProviderSymbols.isPending || syncAllSymbols.isPending
    || enableProvider.isPending || disableProvider.isPending || exportStatus.isPending;

  const error = providersQuery.error instanceof Error ? providersQuery.error.message : "";

  const openCreate = () => {
    setModalMode("create");
    setSelectedProvider(null);
    setModalOpen(true);
  };

  const openEdit = (provider: MarketDataProvider) => {
    setModalMode("edit");
    setSelectedProvider(provider);
    setModalOpen(true);
  };

  const handleDelete = async (provider: MarketDataProvider) => {
    if (!window.confirm(`Archive provider "${provider.name}"?`)) return;
    await deleteProvider.mutateAsync(provider.id);
  };

  const handleExport = async () => {
    const csv = await exportStatus.mutateAsync();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "market-data-status.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (values: ProviderFormValues) => {
    if (modalMode === "create") await createProvider.mutateAsync(values);
    else if (selectedProvider) await updateProvider.mutateAsync({ id: selectedProvider.id, body: values });
  };

  const detailsProvider = useMemo(() => detailsQuery.data?.provider || selectedProvider, [detailsQuery.data?.provider, selectedProvider]);

  if (error && !data) {
    return <main className="mdoc-dashboard"><section className="mdoc-panel"><h1>Market Data Providers</h1><p>{error}</p><button className="mdoc-button primary" onClick={() => providersQuery.refetch()}>Retry</button></section></main>;
  }
  if (!data) return <main className="mdoc-dashboard"><section className="mdoc-panel"><h1>Market Data Providers</h1><p>Loading market data operations center...</p></section></main>;

  return (
    <main className="mdoc-dashboard">
      <Header
        header={data.header}
        busy={busy}
        onAddProvider={openCreate}
        onTestProviders={() => testAllProviders.mutate()}
        onSyncSymbols={() => syncAllSymbols.mutate()}
        onExport={handleExport}
        onRefresh={() => providersQuery.refetch()}
      />
      {error ? <p className="mdoc-error">{error}</p> : null}
      {data.empty ? (
        <EmptyState onAddProvider={openCreate} onOpenSourceConfig={() => router.push("/workspace/market-intelligence/source-configuration")} />
      ) : (
        <>
          <StatusBanner banner={data.banner} />
          <KpiCards kpis={data.kpis} />
          <ProviderRegistry
            providers={data.providers}
            busy={busy}
            onConfigure={openEdit}
            onEdit={openEdit}
            onTest={(id) => testProvider.mutate(id)}
            onSync={(id) => syncProviderSymbols.mutate(id)}
            onEnable={(id) => enableProvider.mutate(id)}
            onDisable={(id) => disableProvider.mutate(id)}
            onDetails={(provider) => { setSelectedProvider(provider); setDetailsId(provider.id); setDetailsOpen(true); }}
            onLogs={() => setLogsOpen(true)}
            onDelete={handleDelete}
          />
          <LiveFeedMonitor feed={data.liveFeed} />
          <AssetCoverageMatrix coverage={data.coverage} />
          <div className="mdoc-grid-2">
            <TickQualityMonitor tickQuality={data.tickQuality} />
            <SpreadQualityCenter spreadQuality={data.spreadQuality} />
          </div>
          <div className="mdoc-grid-2">
            <LatencyMonitor latency={data.latencyMonitor} />
            <DataIntegrityEngine integrity={data.integrity} />
          </div>
          <SymbolAvailabilityMatrix matrix={data.symbolAvailability} />
          <div className="mdoc-grid-2">
            <ProviderComparisonCenter comparison={data.comparison} />
            <WorkflowImpactPanel impacts={data.workflowImpacts} />
          </div>
          <MarketDataLogs logs={logs} />
        </>
      )}
      <ActionCenter
        busy={busy}
        onAddProvider={openCreate}
        onTestProvider={() => data.providers[0] && testProvider.mutate(data.providers[0].id)}
        onTestAll={() => testAllProviders.mutate()}
        onSyncSymbols={() => syncAllSymbols.mutate()}
        onRefreshFeeds={() => providersQuery.refetch()}
        onExport={handleExport}
        onOpenLogs={() => setLogsOpen(true)}
      />
      <ProviderFormModal key={`${modalMode}-${selectedProvider?.id || "new"}`} open={modalOpen} mode={modalMode} initial={selectedProvider} busy={busy} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      <ProviderDetailsDrawer open={detailsOpen} provider={detailsProvider} coverage={detailsQuery.data?.coverage || []} logs={detailsQuery.data?.logs || []} onClose={() => setDetailsOpen(false)} />
      <LogsDrawer open={logsOpen} logs={logs} onClose={() => setLogsOpen(false)} />
    </main>
  );
}
