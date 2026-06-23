"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertCircle, Brain, Loader2, RefreshCw, TrendingDown, TrendingUp, Zap } from "lucide-react";
import {
  enrichCurrencyStrength,
  evaluateHybridDecisionWithLiveCurrencyStrength,
  getLatestCurrencyStrength,
} from "@/lib/api/currency-strength";
import { createDefaultHybridDecision } from "@/lib/api/decisioning";
import { getApprovedSymbols } from "@/lib/api/trading-universe";
import type {
  CurrencyStrengthEnrichment,
  CurrencyStrengthSnapshot,
  HybridDecisionResponse,
  TradingSymbol,
} from "@/lib/api/types";
import type { ResolvedPage } from "@/features/command-center/config/navigation";

type BreadcrumbsProps = { page: ResolvedPage };

type CurrencyStrengthMatrixBoardProps = {
  page: ResolvedPage;
  Breadcrumbs: (props: BreadcrumbsProps) => React.ReactNode;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const currencyOrder = ["EUR", "GBP", "USD", "JPY", "AUD", "NZD", "CAD", "CHF"];

const timeframeLabels: Record<string, string> = {
  Y1: "Y1",
};

const timeframeTitles: Record<string, string> = {
  M15: "15-minute bias",
  M30: "30-minute bias",
  H1: "1-hour bias",
  H4: "4-hour bias",
  H8: "8-hour session bias",
  H12: "12-hour institutional bias",
  D1: "Daily bias",
  W1: "Weekly bias",
  MN1: "Monthly bias",
  Y1: "Yearly / annual institutional bias",
};

function strengthHeatStyle(value: number): React.CSSProperties {
  const clamped = Math.max(-100, Math.min(100, value));
  const ratio = (clamped + 100) / 200;
  const hue = ratio * 128;
  const intensity = Math.abs(clamped) / 100;

  // Moderately dense: soft neutral center, richer tint toward extremes.
  const saturation = 42 + intensity * 44;
  const lightness = 91 - intensity * 36;
  const useLightText = intensity > 0.58;

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: useLightText
      ? "hsl(0 0% 98%)"
      : `hsl(${hue} ${Math.min(78, saturation + 6)}% ${Math.max(17, 28 - intensity * 8)}%)`,
    fontWeight: intensity >= 0.3 ? 800 : 700,
  };
}

function strengthBand(value: number) {
  if (value >= 60) return "Very strong";
  if (value >= 35) return "Strong";
  if (value >= 15) return "Moderate bullish";
  if (value > -15) return "Neutral";
  if (value > -35) return "Moderate bearish";
  if (value > -60) return "Weak";
  return "Very weak";
}

function formatTimeframeLabel(timeframe: string) {
  return timeframeLabels[timeframe] ?? timeframe;
}

function formatScore(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function biasTone(bias: string) {
  if (bias === "BUY") return "success";
  if (bias === "SELL") return "danger";
  return "neutral";
}

export function CurrencyStrengthMatrixBoard({ page, Breadcrumbs }: CurrencyStrengthMatrixBoardProps) {
  const [snapshot, setSnapshot] = useState<CurrencyStrengthSnapshot | null>(null);
  const [snapshotState, setSnapshotState] = useState<LoadState>("idle");
  const [snapshotError, setSnapshotError] = useState("");
  const [symbols, setSymbols] = useState<TradingSymbol[]>([]);
  const [symbol, setSymbol] = useState("EURUSD");
  const [enrichment, setEnrichment] = useState<CurrencyStrengthEnrichment | null>(null);
  const [enrichmentState, setEnrichmentState] = useState<LoadState>("idle");
  const [aiResult, setAiResult] = useState<HybridDecisionResponse | null>(null);
  const [aiState, setAiState] = useState<LoadState>("idle");
  const [aiError, setAiError] = useState("");

  const loadSnapshot = useCallback(async () => {
    setSnapshotState("loading");
    setSnapshotError("");

    try {
      const latest = await getLatestCurrencyStrength();
      setSnapshot(latest);
      setSnapshotState("ready");
    } catch (error) {
      setSnapshotState("error");
      setSnapshotError(error instanceof Error ? error.message : "Currency strength snapshot could not be loaded.");
    }
  }, []);

  const loadEnrichment = useCallback(async (selectedSymbol: string) => {
    setEnrichmentState("loading");

    try {
      const result = await enrichCurrencyStrength(selectedSymbol);
      setEnrichment(result);
      setEnrichmentState("ready");
    } catch {
      setEnrichment(null);
      setEnrichmentState("error");
    }
  }, []);

  const loadSymbols = useCallback(async () => {
    try {
      const approved = await getApprovedSymbols();
      setSymbols(approved);
      if (!approved.some((item) => item.code === symbol)) {
        setSymbol(approved[0]?.code ?? "EURUSD");
      }
    } catch {
      setSymbols([]);
    }
  }, [symbol]);

  useEffect(() => {
    void loadSnapshot();
    void loadSymbols();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadSnapshot, loadSymbols]);

  useEffect(() => {
    if (symbol) {
      void loadEnrichment(symbol);
    }
  }, [loadEnrichment, symbol]);

  const rankedCurrencies = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return currencyOrder
      .map((code) => ({
        code,
        score: snapshot.currencies[code] ?? 0,
      }))
      .sort((left, right) => right.score - left.score);
  }, [snapshot]);

  const handleAiEvaluate = async () => {
    setAiState("loading");
    setAiError("");
    setAiResult(null);

    try {
      const payload = createDefaultHybridDecision(symbol);
      const result = await evaluateHybridDecisionWithLiveCurrencyStrength(payload);
      setAiResult(result);
      setAiState("ready");

      if (typeof window !== "undefined" && enrichment) {
        window.localStorage.setItem("cacsms.currencyStrengthScore", String(enrichment.currencyStrengthScore));
        window.localStorage.setItem("cacsms.currencyStrengthSymbol", symbol);
      }
    } catch (error) {
      setAiState("error");
      setAiError(error instanceof Error ? error.message : "AI evaluation with live currency strength failed.");
    }
  };

  return (
    <div className="currency-strength-board">
      <Breadcrumbs page={page} />

      <section className="workbench-hero panel">
        <div>
          <p className="eyebrow">Macro Intelligence — Currency Strength Engine</p>
          <h1>Currency Strength Matrix</h1>
          <p>
            Institutional currency strength across M15, M30, H1, H4, H8, H12, D1, W1, MN1, and Y1 (yearly). This page feeds the AI
            decision engine with live strong-vs-weak ranking, HTF alignment, and macro gate scores.
          </p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => { void loadSnapshot(); void loadEnrichment(symbol); }}>
          <RefreshCw size={16} />
          Refresh matrix
        </button>
      </section>

      <section className="status-strip" aria-label="Currency strength status">
        <StatusPill
          label="Data source"
          value={snapshot?.source === "mt5" ? "MT5 live feed" : snapshot?.source === "demo" ? "Demo snapshot" : "Unavailable"}
          tone={snapshot?.source === "mt5" ? "success" : snapshot?.source === "demo" ? "warning" : "danger"}
        />
        <StatusPill
          label="HTF alignment"
          value={snapshot?.htfAlignment ?? "Loading..."}
          tone={snapshot?.htfAlignment === "ALIGNED" ? "success" : "warning"}
        />
        <StatusPill
          label="Signal quality"
          value={snapshot?.signalQuality ?? "Loading..."}
          tone={snapshot?.signalQuality === "A" || snapshot?.signalQuality === "B" ? "success" : "warning"}
        />
        <StatusPill
          label="Updated"
          value={snapshot ? new Date(snapshot.updatedAt).toLocaleTimeString() : "Loading..."}
          tone="info"
        />
      </section>

      {snapshotError && (
        <div className="workbench-alert" role="alert">
          <AlertCircle size={16} />
          <span>{snapshotError}</span>
        </div>
      )}

      {snapshot && (
        <>
          <section className="cs-metrics-grid">
            <MetricCard label="Strongest" value={snapshot.strongest} detail={`${formatScore(snapshot.currencies[snapshot.strongest] ?? 0)} composite`} icon={TrendingUp} tone="success" />
            <MetricCard label="Weakest" value={snapshot.weakest} detail={`${formatScore(snapshot.currencies[snapshot.weakest] ?? 0)} composite`} icon={TrendingDown} tone="danger" />
            <MetricCard label="Best opportunity" value={snapshot.bestOpportunity} detail={`Bias ${snapshot.tradeBias}`} icon={Zap} tone={biasTone(snapshot.tradeBias)} />
            <MetricCard label="Confidence" value={`${snapshot.confidence.toFixed(1)}%`} detail={`Differential ${snapshot.strengthDifferential.toFixed(1)}`} icon={Brain} tone="info" />
          </section>

          <section className="workbench-grid cs-page-grid">
            <article className="panel cs-matrix-panel">
              <div className="panel-header">
                <div>
                  <h2>Multi-timeframe matrix</h2>
                  <p>Heat-mapped scores from -100 (very weak) to +100 (very strong), with institutional weighting toward Y1, MN1, W1, and D1.</p>
                </div>
              </div>

              <div className="cs-heat-legend" aria-hidden="true">
                <span>Very weak</span>
                <div className="cs-heat-legend-bar" />
                <span>Neutral</span>
                <div className="cs-heat-legend-bar reverse" />
                <span>Very strong</span>
              </div>

              <div className="cs-matrix-scroll">
                <table className="cs-matrix-table">
                  <thead>
                    <tr>
                      <th scope="col" title="Currency">Cur</th>
                      {snapshot.timeframes.map((timeframe) => (
                        <th key={timeframe} scope="col" title={timeframeTitles[timeframe] ?? timeframe}>
                          {formatTimeframeLabel(timeframe)}
                        </th>
                      ))}
                      <th scope="col" title="Institutionally weighted composite">Comp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedCurrencies.map((currency) => (
                      <tr key={currency.code}>
                        <th scope="row">{currency.code}</th>
                        {snapshot.timeframes.map((timeframe) => {
                          const value = snapshot.timeframeMatrix[currency.code]?.[timeframe] ?? 0;
                          return (
                            <td
                              key={`${currency.code}-${timeframe}`}
                              className="cs-cell"
                              style={strengthHeatStyle(value)}
                              title={`${currency.code} ${timeframe}: ${formatScore(value)} (${strengthBand(value)})`}
                            >
                              {formatScore(value)}
                            </td>
                          );
                        })}
                        <td
                          className="cs-cell cs-composite"
                          style={strengthHeatStyle(currency.score)}
                          title={`${currency.code} composite: ${formatScore(currency.score)} (${strengthBand(currency.score)})`}
                        >
                          {formatScore(currency.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="side-stack">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h2>AI macro gate</h2>
                    <p>Map the live matrix into the hybrid decision engine currency strength gate.</p>
                  </div>
                </div>

                <label className="cs-symbol-field">
                  Focus symbol
                  <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                    {(symbols.length > 0 ? symbols.map((item) => item.code) : ["EURUSD", "GBPUSD", "XAUUSD"]).map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>

                {enrichment && (
                  <div className="cs-enrichment-card">
                    <div className="cs-enrichment-row">
                      <span>Gate score</span>
                      <strong>{enrichment.currencyStrengthScore.toFixed(1)}</strong>
                    </div>
                    <div className="cs-enrichment-row">
                      <span>Trade bias</span>
                      <strong className={clsx(`tone-${biasTone(enrichment.tradeBias)}`)}>{enrichment.tradeBias}</strong>
                    </div>
                    <div className="cs-enrichment-row">
                      <span>Confidence</span>
                      <strong>{enrichment.confidence.toFixed(1)}%</strong>
                    </div>
                    <div className="cs-enrichment-row">
                      <span>Ranking</span>
                      <strong>{enrichment.strongest} vs {enrichment.weakest}</strong>
                    </div>
                  </div>
                )}

                <div className="workbench-actions cs-actions">
                  <button className="button button-primary" type="button" onClick={() => { void handleAiEvaluate(); }} disabled={aiState === "loading" || enrichmentState !== "ready"}>
                    {aiState === "loading" ? <Loader2 size={16} className="spin" /> : <Brain size={16} />}
                    Evaluate with live currency strength
                  </button>
                </div>

                <p className="cs-footnote">
                  Decision-support only. Final trade approval still requires trend, structure, liquidity, volatility, spread, session, risk, and news gates.
                </p>

                <Link className="button button-secondary cs-workbench-link" href="/ai-decision-engine/decision-workbench">
                  Open Decision Workbench
                </Link>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Rejection reasons</h2>
                    <p>Why the matrix may block a trade even when a pair looks attractive.</p>
                  </div>
                </div>
                <ul className="cs-reason-list">
                  {(snapshot.rejectionReasons === "None"
                    ? ["No active currency-strength rejections."]
                    : snapshot.rejectionReasons.split(";").map((item) => item.trim()).filter(Boolean)
                  ).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            </aside>
          </section>

          {(aiResult || aiError) && (
            <section className="panel cs-ai-result">
              <div className="panel-header">
                <div>
                  <h2>AI decision output</h2>
                  <p>Hybrid decision result using the live currency strength gate for {symbol}.</p>
                </div>
              </div>

              {aiError && (
                <div className="workbench-alert" role="alert">
                  <AlertCircle size={16} />
                  <span>{aiError}</span>
                </div>
              )}

              {aiResult && (
                <div className="workbench-result-summary">
                  <div className="workbench-result-header">
                    <div>
                      <span>Recommendation</span>
                      <strong>{aiResult.recommendation}</strong>
                    </div>
                    <div>
                      <span>Direction</span>
                      <strong>{aiResult.direction}</strong>
                    </div>
                    <div>
                      <span>Confidence</span>
                      <strong>{aiResult.confidenceScore.toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span>Macro score</span>
                      <strong>{aiResult.macroScore.toFixed(1)}</strong>
                    </div>
                  </div>

                  {aiResult.evidence.length > 0 && (
                    <div className="cs-evidence-block">
                      <strong>Evidence</strong>
                      <ul>
                        {aiResult.evidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiResult.noTradeReasons.length > 0 && (
                    <div className="cs-evidence-block">
                      <strong>No-trade reasons</strong>
                      <ul>
                        {aiResult.noTradeReasons.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {snapshotState === "loading" && !snapshot && (
        <div className="workbench-empty">
          <Loader2 size={24} className="spin" />
          <span>Loading currency strength matrix...</span>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "info" }) {
  return (
    <div className={clsx("status-pill", `tone-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: "success" | "danger" | "info" | "neutral";
}) {
  return (
    <article className={clsx("cs-metric-card", `tone-${tone}`)}>
      <div className="cs-metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
