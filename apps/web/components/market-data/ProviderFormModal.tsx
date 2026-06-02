"use client";

import { useMemo, useState } from "react";
import type { MarketDataProvider, ProviderFormValues } from "../../lib/market-data/types";
import { defaultAddProviderValues } from "../../lib/market-data/provider-schema";

const PROVIDER_TYPES = ["MT5", "Broker Price Feed", "TwelveData", "Polygon", "Finnhub", "AlphaVantage", "TradingView", "Custom Feed"];
const CONNECTION_METHODS = ["REST API", "WebSocket", "MT5 Bridge", "FIX", "Manual Upload", "Hybrid"];
const AUTH_TYPES = ["None", "API Key", "Bearer Token", "OAuth", "Vault Secret"];

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: MarketDataProvider | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => Promise<void>;
};

const emptyValues: ProviderFormValues = {
  name: "",
  providerType: "MT5",
  description: "",
  vendorWebsite: "",
  contactInfo: "",
  notes: "",
  connectionMethod: "MT5 Bridge",
  baseUrl: "",
  websocketUrl: "",
  port: "",
  environment: "Production",
  enabled: true,
  authType: "None",
  vaultSecretRef: "",
  capabilities: defaultAddProviderValues.capabilities,
  assetCoverage: ["Forex"],
  supportedSymbols: ""
};

export function ProviderFormModal({ open, mode, initial, busy, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<ProviderFormValues>(() => initial ? {
    name: initial.name,
    providerType: initial.providerType || initial.type,
    description: "",
    vendorWebsite: "",
    contactInfo: "",
    connectionMethod: initial.connectionMethod || "REST API",
    baseUrl: initial.baseUrl || "",
    websocketUrl: initial.websocketUrl || "",
    port: "",
    authType: initial.authType || "None",
    vaultSecretRef: initial.vaultSecretRef || "",
    environment: initial.environment || "Production",
    enabled: initial.enabled,
    assetCoverage: initial.supportedAssetClasses || ["Forex"],
    supportedSymbols: "",
    capabilities: defaultAddProviderValues.capabilities,
    notes: initial.notes || ""
  } : emptyValues);
  const [error, setError] = useState("");

  const title = useMemo(() => mode === "create" ? "Add Provider" : "Edit Provider", [mode]);
  if (!open) return null;

  const update = (patch: Partial<ProviderFormValues>) => setValues((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setError("");
    try {
      await onSubmit(values);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed");
    }
  };

  return (
    <div className="mdoc-modal-backdrop" onClick={onClose}>
      <section className="mdoc-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mdoc-panel-head"><h2>{title}</h2><button className="mdoc-button secondary" onClick={onClose}>Close</button></div>
        {error ? <p className="mdoc-error">{error}</p> : null}
        <div className="mdoc-form-grid">
          <label>Provider Name<input value={values.name} onChange={(event) => update({ name: event.target.value })} /></label>
          <label>Provider Type<select value={values.providerType} onChange={(event) => update({ providerType: event.target.value })}>{PROVIDER_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Connection Method<select value={values.connectionMethod} onChange={(event) => update({ connectionMethod: event.target.value })}>{CONNECTION_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Environment<input value={values.environment} onChange={(event) => update({ environment: event.target.value })} /></label>
          <label>Base URL<input value={values.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} /></label>
          <label>WebSocket URL<input value={values.websocketUrl} onChange={(event) => update({ websocketUrl: event.target.value })} /></label>
          <label>Authentication Type<select value={values.authType} onChange={(event) => update({ authType: event.target.value })}>{AUTH_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Vault Secret Reference<input value={values.vaultSecretRef} onChange={(event) => update({ vaultSecretRef: event.target.value })} placeholder="Vault reference only" /></label>
          <label className="mdoc-span-2">Supported Asset Classes
            <div className="mdoc-chip-row">{["Forex", "Indices", "Metals", "Commodities", "Crypto"].map((item) => (
              <button
                key={item}
                type="button"
                className={`mdoc-chip ${values.assetCoverage.includes(item) ? "active" : ""}`}
                onClick={() => update({
                  assetCoverage: values.assetCoverage.includes(item)
                    ? values.assetCoverage.filter((value) => value !== item)
                    : [...values.assetCoverage, item]
                })}
              >{item}</button>
            ))}</div>
          </label>
          <label className="mdoc-span-2">Notes<textarea value={values.notes} onChange={(event) => update({ notes: event.target.value })} /></label>
          <label className="mdoc-checkbox"><input type="checkbox" checked={values.enabled} onChange={(event) => update({ enabled: event.target.checked })} /> Enabled</label>
        </div>
        <div className="mdoc-header-actions"><button className="mdoc-button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="mdoc-button primary" disabled={busy} onClick={submit}>Save Provider</button></div>
      </section>
    </div>
  );
}
