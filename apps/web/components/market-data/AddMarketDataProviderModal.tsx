"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, X } from "lucide-react";
import {
  addProviderSchema,
  defaultAddProviderValues,
  type AddProviderFormValues,
  type CoveragePreview,
  type ProviderTestResult
} from "../../lib/market-data/provider-schema";

const PROVIDER_TYPES = [
  "MT5", "Broker Feed", "TwelveData", "Polygon", "Finnhub",
  "AlphaVantage", "TradingView", "DXFeed", "Bloomberg", "Refinitiv", "Custom Feed"
];

const CONNECTION_METHODS = ["REST API", "WebSocket", "MT5 Bridge", "FIX", "Database", "Manual Upload", "Hybrid"];
const AUTH_TYPES = ["None", "API Key", "Bearer Token", "OAuth", "Vault Secret"];
const ENVIRONMENTS = ["Development", "Testing", "Staging", "Production"];
const ASSET_OPTIONS = ["Forex", "Indices", "Metals", "Commodities", "Crypto", "Bonds", "Equities"];
const CAPABILITIES: Array<[keyof AddProviderFormValues["capabilities"], string]> = [
  ["realTimePrices", "Real-Time Prices"],
  ["historicalData", "Historical Data"],
  ["tickData", "Tick Data"],
  ["spreadData", "Spread Data"],
  ["volumeData", "Volume Data"],
  ["depthOfMarket", "Depth of Market"],
  ["newsData", "News Data"],
  ["sentimentData", "Sentiment Data"],
  ["economicData", "Economic Data"],
  ["cotData", "COT Data"]
];

type Props = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onSave: (values: AddProviderFormValues, options: { draft: boolean }) => Promise<void>;
  onTestConnection: (values: AddProviderFormValues) => Promise<ProviderTestResult>;
  onValidate: (values: AddProviderFormValues) => Promise<{ valid: boolean; message: string }>;
  onPreviewCoverage: (values: AddProviderFormValues) => Promise<CoveragePreview>;
};

export function AddMarketDataProviderModal({
  open, busy, onClose, onSave, onTestConnection, onValidate, onPreviewCoverage
}: Props) {
  const form = useForm<AddProviderFormValues>({
    resolver: zodResolver(addProviderSchema),
    defaultValues: defaultAddProviderValues
  });

  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [coveragePreview, setCoveragePreview] = useState<CoveragePreview | null>(null);
  const [actionError, setActionError] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(defaultAddProviderValues);
      setTestResult(null);
      setValidationMessage("");
      setCoveragePreview(null);
      setActionError("");
    }
  }, [open, form]);

  if (!open) return null;

  const submit = form.handleSubmit(async (values) => {
    setActionError("");
    try {
      await onSave(values, { draft: false });
      onClose();
    } catch (reason) {
      setActionError(formatError(reason));
    }
  });

  const saveDraft = form.handleSubmit(async (values) => {
    setActionError("");
    try {
      await onSave(values, { draft: true });
      onClose();
    } catch (reason) {
      setActionError(formatError(reason));
    }
  });

  const runTest = async () => {
    setActionError("");
    setTesting(true);
    try {
      const values = form.getValues();
      const valid = await form.trigger();
      if (!valid) return;
      setTestResult(await onTestConnection(values));
    } catch (reason) {
      setActionError(formatError(reason));
      setTestResult({ status: "FAILED", latency_ms: 0, provider_health: 0, symbols_found: 0, message: formatError(reason) });
    } finally {
      setTesting(false);
    }
  };

  const runValidate = async () => {
    setActionError("");
    try {
      const values = form.getValues();
      const valid = await form.trigger();
      if (!valid) return;
      const result = await onValidate(values);
      setValidationMessage(result.message);
    } catch (reason) {
      setActionError(formatError(reason));
    }
  };

  const runPreview = async () => {
    setActionError("");
    try {
      const values = form.getValues();
      setCoveragePreview(await onPreviewCoverage(values));
    } catch (reason) {
      setActionError(formatError(reason));
    }
  };

  const toggleAsset = (asset: string) => {
    const current = form.getValues("assetCoverage");
    form.setValue(
      "assetCoverage",
      current.includes(asset) ? current.filter((item) => item !== asset) : [...current, asset],
      { shouldValidate: true }
    );
  };

  const { register, watch, setValue, formState: { errors } } = form;
  const authType = watch("authType");
  const enabled = watch("enabled");

  return (
    <div className="mdoc-modal-backdrop" onClick={onClose}>
      <section className="mdoc-modal mdoc-add-provider-modal" onClick={(event) => event.stopPropagation()}>
        <header className="mdoc-modal-header">
          <div>
            <p className="eyebrow">MARKET DATA ONBOARDING WIZARD</p>
            <h2>Add Market Data Provider</h2>
            <p className="subtitle">Guided onboarding for MT5 terminals, broker feeds, and vendors. Technical URLs are configured automatically for standard providers.</p>
          </div>
          <button type="button" className="mdoc-icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        {actionError ? <p className="mdoc-error">{actionError}</p> : null}
        {testResult ? (
          <div className={`mdoc-test-banner ${testResult.status === "SUCCESS" ? "success" : "danger"}`}>
            <strong>{testResult.status === "SUCCESS" ? "Connection successful" : "Connection failed"}</strong>
            <span>{testResult.message}</span>
            <small>Latency {testResult.latency_ms}ms · Health {testResult.provider_health}% · Symbols {testResult.symbols_found}</small>
          </div>
        ) : null}
        {validationMessage ? <div className="mdoc-test-banner success"><strong>Configuration validated</strong><span>{validationMessage}</span></div> : null}
        {coveragePreview ? (
          <div className="mdoc-test-banner">
            <strong>Coverage preview</strong>
            <span>{coveragePreview.estimatedCoverage} symbols · {coveragePreview.coveragePct}% of universe</span>
          </div>
        ) : null}

        <form className="mdoc-add-provider-form" onSubmit={submit}>
          <section className="mdoc-form-section">
            <h3>1. Provider Information</h3>
            <div className="mdoc-form-grid">
              <label>Provider Name *<input {...register("name")} placeholder="IC Markets MT5 Feed" />{errors.name ? <em>{errors.name.message}</em> : null}</label>
              <label>Provider Type *<select {...register("providerType")}>{PROVIDER_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="mdoc-span-2">Description<textarea {...register("description")} /></label>
              <label>Vendor Website<input {...register("vendorWebsite")} placeholder="https://..." /></label>
              <label>Contact Information<input {...register("contactInfo")} /></label>
              <label className="mdoc-span-2">Internal Notes<textarea {...register("notes")} /></label>
            </div>
          </section>

          <section className="mdoc-form-section">
            <h3>2. Connection Configuration</h3>
            <div className="mdoc-form-grid">
              <label>Connection Method *<select {...register("connectionMethod")}>{CONNECTION_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Environment *<select {...register("environment")}>{ENVIRONMENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Base URL<input {...register("baseUrl")} placeholder="https://api.provider.com" />{errors.baseUrl ? <em>{errors.baseUrl.message}</em> : null}</label>
              <label>WebSocket URL<input {...register("websocketUrl")} />{errors.websocketUrl ? <em>{errors.websocketUrl.message}</em> : null}</label>
              <label>Port<input {...register("port")} placeholder="443" /></label>
              <label className="mdoc-checkbox"><input type="checkbox" checked={enabled} onChange={(event) => setValue("enabled", event.target.checked)} /> Enable Provider</label>
            </div>
          </section>

          <section className="mdoc-form-section">
            <h3>3. Authentication</h3>
            <div className="mdoc-form-grid">
              <label>Authentication Type *<select {...register("authType")}>{AUTH_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Vault Secret Reference<input {...register("vaultSecretRef")} placeholder="MARKETDATA_TWELVEDATA_API_KEY" disabled={authType === "None"} />{errors.vaultSecretRef ? <em>{errors.vaultSecretRef.message}</em> : null}</label>
            </div>
            <p className="mdoc-help">Never store raw API keys. Store only secure vault references.</p>
          </section>

          <section className="mdoc-form-section">
            <h3>4. Capabilities</h3>
            <div className="mdoc-capability-grid">
              {CAPABILITIES.map(([key, label]) => (
                <label key={key} className="mdoc-checkbox"><input type="checkbox" {...register(`capabilities.${key}`)} /> {label}</label>
              ))}
            </div>
          </section>

          <section className="mdoc-form-section">
            <h3>5. Asset Coverage</h3>
            <div className="mdoc-chip-row">{ASSET_OPTIONS.map((item) => (
              <button key={item} type="button" className={`mdoc-chip ${watch("assetCoverage").includes(item) ? "active" : ""}`} onClick={() => toggleAsset(item)}>{item}</button>
            ))}</div>
            <label className="mdoc-span-2">Supported Symbols<textarea {...register("supportedSymbols")} placeholder="EURUSD, GBPUSD, XAUUSD, NAS100, US30" /></label>
          </section>

          <section className="mdoc-form-section">
            <h3>6. Validation &amp; Testing</h3>
            <div className="mdoc-header-actions">
              <button type="button" className="mdoc-button secondary" disabled={busy || testing} onClick={runTest}>Test Connection</button>
              <button type="button" className="mdoc-button secondary" disabled={busy} onClick={runValidate}>Validate Configuration</button>
              <button type="button" className="mdoc-button secondary" disabled={busy} onClick={runPreview}>Preview Coverage</button>
            </div>
          </section>

          <footer className="mdoc-modal-footer">
            <button type="button" className="mdoc-button secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="mdoc-button secondary" disabled={busy} onClick={saveDraft}>Save Draft</button>
            <button type="submit" className="mdoc-button primary" disabled={busy}><Plus size={14} /> Save Provider</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function formatError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Request failed";
  return message.replaceAll("_", " ");
}
