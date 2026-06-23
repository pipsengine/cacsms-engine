"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";
import { createDefaultHybridDecision, evaluateHybridDecisionPersisted, getApiHealth, getDecisionHistory } from "@/lib/api/decisioning";
import { enrichCurrencyStrength } from "@/lib/api/currency-strength";
import { getApprovedSymbols } from "@/lib/api/trading-universe";
import type { DecisionHistoryItem, HybridDecisionRequest, HybridDecisionResponse, TradingSymbol } from "@/lib/api/types";
import type { ResolvedPage } from "@/features/command-center/config/navigation";

function isScalpOnlySymbol(symbol: TradingSymbol) {
  return symbol.allowedStyle === "ScalpOnly" || symbol.allowedStyle === 1;
}

type BreadcrumbsProps = { page: ResolvedPage };

type DecisionWorkbenchBoardProps = {
  page: ResolvedPage;
  Breadcrumbs: (props: BreadcrumbsProps) => React.ReactNode;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function DecisionWorkbenchBoard({ page, Breadcrumbs }: DecisionWorkbenchBoardProps) {
  const [symbols, setSymbols] = useState<TradingSymbol[]>([]);
  const [symbolsState, setSymbolsState] = useState<LoadState>("idle");
  const [healthState, setHealthState] = useState<LoadState>("idle");
  const [healthMessage, setHealthMessage] = useState("");
  const [symbolsError, setSymbolsError] = useState("");
  const [form, setForm] = useState<HybridDecisionRequest>(createDefaultHybridDecision());
  const [result, setResult] = useState<HybridDecisionResponse | null>(null);
  const [savedDecisionId, setSavedDecisionId] = useState<string | null>(null);
  const [savedCreatedAt, setSavedCreatedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionHistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<LoadState>("idle");
  const [historyError, setHistoryError] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateError, setEvaluateError] = useState("");

  const loadHistory = useCallback(async () => {
    setHistoryState("loading");
    setHistoryError("");

    try {
      const items = await getDecisionHistory(50);
      setHistory(items);
      setHistoryState("ready");
    } catch (error) {
      setHistoryState("error");
      setHistoryError(error instanceof Error ? error.message : "Decision history could not be loaded.");
    }
  }, []);

  const loadConnectivity = useCallback(async () => {
    setHealthState("loading");
    setSymbolsState("loading");
    setSymbolsError("");
    setHealthMessage("");

    try {
      const health = await getApiHealth();
      setHealthState("ready");
      setHealthMessage(`${health.service} — ${health.status}`);
    } catch (error) {
      setHealthState("error");
      setHealthMessage(error instanceof Error ? error.message : "Backend health check failed.");
    }

    try {
      const approved = await getApprovedSymbols();
      setSymbols(approved);
      setSymbolsState("ready");

      const activeSymbol = approved[0]?.code ?? "XAUUSD";
      setForm((current) => {
        const symbol = approved.some((item) => item.code === current.symbol) ? current.symbol : activeSymbol;
        return { ...createDefaultHybridDecision(symbol), tradingMode: current.tradingMode };
      });

      try {
        const selectedSymbol = approved.some((item) => item.code === form.symbol) ? form.symbol : activeSymbol;
        const liveStrength = await enrichCurrencyStrength(selectedSymbol);
        setForm((current) => ({
          ...current,
          symbol: selectedSymbol,
          currencyStrengthScore: liveStrength.currencyStrengthScore,
        }));
      } catch {
        // Keep default score when live currency strength is unavailable.
      }
    } catch (error) {
      setSymbolsState("error");
      setSymbolsError(error instanceof Error ? error.message : "Approved symbols could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void loadConnectivity();
    void loadHistory();
  }, [loadConnectivity, loadHistory]);

  const updateForm = <K extends keyof HybridDecisionRequest>(key: K, value: HybridDecisionRequest[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSymbolChange = (symbol: string) => {
    setForm(createDefaultHybridDecision(symbol));
    setResult(null);
    setEvaluateError("");
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvaluateError("");
    setResult(null);
    setSavedDecisionId(null);
    setSavedCreatedAt(null);

    try {
      const persisted = await evaluateHybridDecisionPersisted(form);
      setResult(persisted.decision);
      setSavedDecisionId(persisted.decisionId);
      setSavedCreatedAt(persisted.createdAt);
      await loadHistory();
    } catch (error) {
      setEvaluateError(error instanceof Error ? error.message : "Decision evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  };

  const scoreItems = result
    ? [
        { label: "Top-down bias", value: result.topDownBiasScore },
        { label: "Macro", value: result.macroScore },
        { label: "Market memory", value: result.marketMemoryScore },
        { label: "Advanced algorithms", value: result.advancedAlgorithmScore },
        { label: "Institutional", value: result.institutionalScore },
        { label: "Retail", value: result.retailScore },
        { label: "Hybrid", value: result.hybridScore },
      ]
    : [];

  return (
    <div className="decision-workbench-board">
      <Breadcrumbs page={page} />

      <section className="workbench-hero panel">
        <div>
          <p className="eyebrow">Phase 1 — Persisted Decision History</p>
          <h1>Decision Workbench</h1>
          <p>
            Submit trading context to the ASP.NET Core decisioning API, persist the governed recommendation to SQLite,
            and review live confidence, gate output, and saved decision history.
          </p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => { void loadConnectivity(); void loadHistory(); }}>
          <RefreshCw size={16} />
          Refresh connectivity
        </button>
      </section>

      <section className="status-strip" aria-label="Backend connectivity">
        <ConnectivityPill
          label="Backend API"
          value={healthMessage || "Checking..."}
          state={healthState}
        />
        <ConnectivityPill
          label="Trading universe"
          value={
            symbolsState === "ready"
              ? `${symbols.length} approved symbols`
              : symbolsState === "error"
                ? "Load failed"
                : "Loading..."
          }
          state={symbolsState}
        />
        <ConnectivityPill
          label="Decision store"
          value={historyState === "ready" ? `${history.length} saved records` : historyState === "error" ? "Unavailable" : "Loading..."}
          state={historyState}
        />
        <ConnectivityPill
          label="Mode"
          value={form.tradingMode}
          state="ready"
        />
      </section>

      {symbolsError && (
        <div className="workbench-alert error-state">
          <AlertCircle size={18} />
          <span>{symbolsError}</span>
        </div>
      )}

      <div className="workbench-grid">
        <section className="panel workbench-form-panel">
          <div className="section-heading">
            <div>
              <h2>Decision inputs</h2>
              <p>Core fields sent to the hybrid evaluation endpoint. Remaining scores use governed defaults.</p>
            </div>
          </div>

          <div className="workbench-form-grid">
            <label>
              Symbol
              <select
                value={form.symbol}
                disabled={symbolsState !== "ready"}
                onChange={(event) => handleSymbolChange(event.target.value)}
              >
                {symbols.length === 0 ? (
                  <option value={form.symbol}>{form.symbol}</option>
                ) : (
                  symbols.map((symbol) => (
                    <option key={symbol.code} value={symbol.code}>
                      {symbol.code} ({isScalpOnlySymbol(symbol) ? "Scalp only" : "Intraday / swing"})
                    </option>
                  ))
                )}
              </select>
            </label>

            <label>
              Trading mode
              <select
                value={form.tradingMode}
                onChange={(event) =>
                  updateForm("tradingMode", event.target.value as HybridDecisionRequest["tradingMode"])
                }
              >
                <option value="Hybrid">Hybrid</option>
                <option value="Institutional">Institutional</option>
                <option value="Retail">Retail</option>
              </select>
            </label>

            <label>
              Session
              <select value={form.session} onChange={(event) => updateForm("session", event.target.value)}>
                <option value="London">London</option>
                <option value="New York">New York</option>
                <option value="London-New York Overlap">London-New York Overlap</option>
                <option value="Asian">Asian</option>
              </select>
            </label>

            <label>
              Higher-timeframe bias
              <select
                value={form.higherTimeframeBias}
                onChange={(event) => updateForm("higherTimeframeBias", event.target.value)}
              >
                <option value="Bullish">Bullish</option>
                <option value="Bearish">Bearish</option>
                <option value="Neutral">Neutral</option>
              </select>
            </label>

            <label>
              Entry-timeframe bias
              <select
                value={form.entryTimeframeBias}
                onChange={(event) => updateForm("entryTimeframeBias", event.target.value)}
              >
                <option value="Bullish">Bullish</option>
                <option value="Bearish">Bearish</option>
                <option value="Neutral">Neutral</option>
              </select>
            </label>

            <label>
              Risk / reward
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.riskReward}
                onChange={(event) => updateForm("riskReward", Number(event.target.value))}
              />
            </label>

            <label>
              MTF alignment score
              <input
                type="number"
                min={0}
                max={100}
                value={form.multiTimeframeAlignmentScore}
                onChange={(event) => updateForm("multiTimeframeAlignmentScore", Number(event.target.value))}
              />
            </label>

            <label>
              HTF conflict score
              <input
                type="number"
                min={0}
                max={100}
                value={form.higherTimeframeConflictScore}
                onChange={(event) => updateForm("higherTimeframeConflictScore", Number(event.target.value))}
              />
            </label>

            <label>
              Execution quality
              <input
                type="number"
                min={0}
                max={100}
                value={form.executionQualityScore}
                onChange={(event) => updateForm("executionQualityScore", Number(event.target.value))}
              />
            </label>

            <label>
              Macro bias score
              <input
                type="number"
                min={0}
                max={100}
                value={form.macroBiasScore}
                onChange={(event) => updateForm("macroBiasScore", Number(event.target.value))}
              />
            </label>

            <label>
              Currency strength
              <input
                type="number"
                min={0}
                max={100}
                value={form.currencyStrengthScore}
                onChange={(event) => updateForm("currencyStrengthScore", Number(event.target.value))}
              />
            </label>

            <label>
              Spread (points)
              <input
                type="number"
                min={0}
                value={form.spreadPoints}
                onChange={(event) => updateForm("spreadPoints", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="workbench-toggle-grid">
            <ToggleField
              label="News risk"
              checked={form.newsRisk}
              onChange={(checked) => updateForm("newsRisk", checked)}
            />
            <ToggleField
              label="Liquidity sweep"
              checked={form.liquiditySweep}
              onChange={(checked) => updateForm("liquiditySweep", checked)}
            />
            <ToggleField
              label="Displacement"
              checked={form.displacement}
              onChange={(checked) => updateForm("displacement", checked)}
            />
            <ToggleField
              label="Retail trend aligned"
              checked={form.retailTrendAligned}
              onChange={(checked) => updateForm("retailTrendAligned", checked)}
            />
            <ToggleField
              label="Break of structure"
              checked={form.breakOfStructure}
              onChange={(checked) => updateForm("breakOfStructure", checked)}
            />
            <ToggleField
              label="Pullback confirmation"
              checked={form.pullbackConfirmation}
              onChange={(checked) => updateForm("pullbackConfirmation", checked)}
            />
          </div>

          <div className="workbench-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={evaluating || symbolsState !== "ready" || healthState !== "ready"}
              onClick={() => void handleEvaluate()}
            >
              {evaluating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
              {evaluating ? "Evaluating..." : "Evaluate hybrid decision"}
            </button>
          </div>

          {evaluateError && (
            <div className="workbench-alert error-state">
              <AlertCircle size={18} />
              <span>{evaluateError}</span>
            </div>
          )}
        </section>

        <aside className="workbench-results-stack">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Recommendation</h2>
                <p>Live response from `POST /api/decisioning/hybrid-evaluate/persisted`.</p>
              </div>
            </div>

            {!result && !evaluating && (
              <div className="workbench-empty">
                <p>Run an evaluation to see the backend recommendation, confidence, and gate output.</p>
              </div>
            )}

            {evaluating && (
              <div className="workbench-empty">
                <Loader2 size={24} className="spin" />
                <p>Calling hybrid decision service...</p>
              </div>
            )}

            {result && (
              <div className="workbench-result-summary">
                <div className="workbench-result-header">
                  <div>
                    <span>{result.symbol}</span>
                    <strong>{result.recommendation}</strong>
                    <p>
                      {result.direction} · {result.tradingMode} · {result.approvedStrategy}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "workbench-confidence",
                      result.recommendation === "Execute" ? "execute" : "no-trade",
                    )}
                  >
                    <small>Confidence</small>
                    <strong>{result.confidenceScore}%</strong>
                  </div>
                </div>

                <div className="workbench-meta-grid">
                  {savedDecisionId && <MetaItem label="Decision ID" value={savedDecisionId} />}
                  {savedCreatedAt && (
                    <MetaItem label="Saved at" value={new Date(savedCreatedAt).toLocaleString()} />
                  )}
                  <MetaItem label="Approved risk" value={`${result.approvedRiskPercent}%`} />
                  <MetaItem label="Liquidity target" value={result.liquidityTarget} />
                  <MetaItem label="Invalidation" value={result.invalidationLevel} />
                  <MetaItem label="Expires in" value={`${result.expiresInMinutes} min`} />
                </div>

                <div className="workbench-score-grid">
                  {scoreItems.map((item) => (
                    <div key={item.label} className="workbench-score-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>No-trade reasons</h2>
            {result && result.noTradeReasons.length > 0 ? (
              <ul className="workbench-reason-list">
                {result.noTradeReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="workbench-muted">
                {result?.recommendation === "Execute"
                  ? "No blocking reasons returned. All configured gates passed."
                  : "Reasons will appear here when the backend blocks execution."}
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Evidence</h2>
            {result && result.evidence.length > 0 ? (
              <ul className="workbench-evidence-list">
                {result.evidence.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="workbench-muted">Supporting evidence from the scoring engine will appear here.</p>
            )}
          </section>
        </aside>
      </div>

      <section className="panel workbench-history-panel">
        <div className="section-heading">
          <div>
            <h2>Decision history</h2>
            <p>Persisted records from `GET /api/decisions` (SQLite).</p>
          </div>
          <button className="button button-secondary" type="button" onClick={() => void loadHistory()}>
            <RefreshCw size={16} />
            Refresh history
          </button>
        </div>

        {historyError && (
          <div className="workbench-alert error-state">
            <AlertCircle size={18} />
            <span>{historyError}</span>
          </div>
        )}

        {historyState === "loading" && history.length === 0 && (
          <div className="workbench-empty">
            <Loader2 size={24} className="spin" />
            <p>Loading saved decisions...</p>
          </div>
        )}

        {historyState === "ready" && history.length === 0 && (
          <p className="workbench-muted">No decisions saved yet. Run an evaluation to create the first record.</p>
        )}

        {history.length > 0 && (
          <div className="table-wrap">
            <table className="workbench-history-table">
              <thead>
                <tr>
                  <th>Saved</th>
                  <th>Decision ID</th>
                  <th>Symbol</th>
                  <th>Mode</th>
                  <th>Recommendation</th>
                  <th>Direction</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.decisionId}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.decisionId}</td>
                    <td>{item.symbol}</td>
                    <td>{item.tradingMode}</td>
                    <td>
                      <span
                        className={clsx(
                          "status-badge",
                          item.recommendation === "Execute" ? "status-success" : "status-danger",
                        )}
                      >
                        {item.recommendation}
                      </span>
                    </td>
                    <td>{item.direction}</td>
                    <td>{item.confidenceScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ConnectivityPill({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: LoadState;
}) {
  const tone =
    state === "ready" ? "success" : state === "error" ? "danger" : state === "loading" ? "info" : "neutral";

  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <span className={clsx("status-badge", `status-${tone}`)}>
        {state === "ready" ? "Connected" : state === "error" ? "Error" : state === "loading" ? "Loading" : "Idle"}
      </span>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="workbench-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="workbench-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
