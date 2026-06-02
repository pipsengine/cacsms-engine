"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMarketDataProvider,
  deleteMarketDataProvider,
  disableMarketDataProvider,
  enableMarketDataProvider,
  exportMarketDataStatusCsv,
  fetchMarketDataConfidence,
  fetchMarketDataCoverage,
  fetchMarketDataHealth,
  fetchMarketDataLatency,
  fetchMarketDataLogs,
  fetchMarketDataProvider,
  fetchMarketDataProviders,
  marketDataKeys,
  previewProviderCoverage,
  syncAllMarketDataSymbols,
  syncMarketDataProviderSymbols,
  testAllMarketDataProviders,
  testMarketDataProvider,
  testProviderConfiguration,
  updateMarketDataProvider,
  validateProviderConfiguration,
  type AddProviderFormValues
} from "../../lib/market-data/types";

function invalidateMarketData(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: marketDataKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: marketDataKeys.health() }),
    queryClient.invalidateQueries({ queryKey: marketDataKeys.coverage() }),
    queryClient.invalidateQueries({ queryKey: marketDataKeys.latency() }),
    queryClient.invalidateQueries({ queryKey: marketDataKeys.logs() }),
    queryClient.invalidateQueries({ queryKey: marketDataKeys.confidence() })
  ]);
}

export function useMarketDataProviders() {
  return useQuery({ queryKey: marketDataKeys.providers(), queryFn: fetchMarketDataProviders });
}

export function useMarketDataHealth() {
  return useQuery({ queryKey: marketDataKeys.health(), queryFn: fetchMarketDataHealth });
}

export function useMarketDataCoverage() {
  return useQuery({ queryKey: marketDataKeys.coverage(), queryFn: fetchMarketDataCoverage });
}

export function useMarketDataLatency() {
  return useQuery({ queryKey: marketDataKeys.latency(), queryFn: fetchMarketDataLatency });
}

export function useMarketDataLogs() {
  return useQuery({ queryKey: marketDataKeys.logs(), queryFn: fetchMarketDataLogs });
}

export function useMarketDataConfidence() {
  return useQuery({ queryKey: marketDataKeys.confidence(), queryFn: fetchMarketDataConfidence });
}

export function useMarketDataProviderDetails(id: string | null) {
  return useQuery({
    queryKey: id ? marketDataKeys.provider(id) : marketDataKeys.all,
    queryFn: () => fetchMarketDataProvider(id as string),
    enabled: Boolean(id)
  });
}

export function useCreateMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ values, draft }: { values: AddProviderFormValues; draft?: boolean }) =>
      createMarketDataProvider({ ...values, draft, testOnSave: !draft }),
    onSuccess: (payload) => {
      if (payload.dashboard) queryClient.setQueryData(marketDataKeys.providers(), payload.dashboard);
      return invalidateMarketData(queryClient);
    }
  });
}

export function useTestProviderConfiguration() {
  return useMutation({ mutationFn: (values: AddProviderFormValues) => testProviderConfiguration(values) });
}

export function useValidateProviderConfiguration() {
  return useMutation({ mutationFn: (values: AddProviderFormValues) => validateProviderConfiguration(values) });
}

export function usePreviewProviderCoverage() {
  return useMutation({ mutationFn: (values: AddProviderFormValues) => previewProviderCoverage(values) });
}

export function useUpdateMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AddProviderFormValues> }) => updateMarketDataProvider(id, body),
    onSuccess: (_data, variables) => Promise.all([
      invalidateMarketData(queryClient),
      queryClient.invalidateQueries({ queryKey: marketDataKeys.provider(variables.id) })
    ])
  });
}

export function useDeleteMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMarketDataProvider(id),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useTestMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testMarketDataProvider(id),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useTestAllMarketDataProviders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testAllMarketDataProviders(),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useSyncMarketDataProviderSymbols() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => syncMarketDataProviderSymbols(id),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useSyncAllMarketDataSymbols() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncAllMarketDataSymbols(),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useEnableMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enableMarketDataProvider(id),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useDisableMarketDataProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disableMarketDataProvider(id),
    onSuccess: () => invalidateMarketData(queryClient)
  });
}

export function useExportMarketDataStatus() {
  return useMutation({ mutationFn: () => exportMarketDataStatusCsv() });
}
