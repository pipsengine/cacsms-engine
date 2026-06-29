import { apiFetch } from "@/lib/api/client";
import type {
  DataSourcesOverview,
  BridgeSettingsOverview,
  EngineRuntimeStatus,
  RuntimeConfig,
  SymbolSelectionRulesOverview,
} from "@/lib/api/types";

export function getEngineStatus() {
  return apiFetch<EngineRuntimeStatus>("/api/engine/status");
}

export function startEngine(reason: string) {
  return apiFetch<EngineRuntimeStatus>("/api/engine/start", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function stopEngine(reason: string) {
  return apiFetch<EngineRuntimeStatus>("/api/engine/stop", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getRuntimeConfig() {
  return apiFetch<RuntimeConfig>("/api/runtime/config");
}

export function reloadRuntimeConfig() {
  return apiFetch<RuntimeConfig>("/api/runtime/config/reload", {
    method: "POST",
  });
}

export function getDataSourcesStatus() {
  return apiFetch<DataSourcesOverview>("/api/system/data-sources/status");
}

export function getSymbolSelectionRules() {
  return apiFetch<SymbolSelectionRulesOverview>("/api/symbol-selection/rules");
}

export function getBridgeSettings() {
  return apiFetch<BridgeSettingsOverview>("/api/bridge/settings");
}
