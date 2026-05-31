"use client";

import { useState } from "react";
import type { DataSourceItem } from "../../lib/workflow/market-intelligence-sources";

export type MarketIntelligenceCenterCardProps = {
  sources: DataSourceItem[];
  dataQualityScore: number;
  freshnessStatus: "LIVE" | "RECENT" | "STALE";
  validationStatus: "PASSED" | "WARNING" | "FAILED";
  criticalSourcesOnline: number;
  criticalSourcesTotal: number;
  proceedStatus: "ALLOWED" | "RESTRICTED" | "BLOCKED";
};

export function MarketIntelligenceCenterCard(props: MarketIntelligenceCenterCardProps) {
  const [expanded, setExpanded] = useState(true);
  const blocked = props.proceedStatus === "BLOCKED";
  return (
    <article id="market-intelligence-center" className="market-intelligence-card">
      <header className="market-intelligence-header">
        <div><span className="market-intelligence-icon">RADAR</span><div><h2>MARKET INTELLIGENCE CENTER</h2><p>Data Sources & Feed Health Layer</p></div></div>
        <span className="market-intelligence-live">LIVE</span>
      </header>
      <button type="button" className="market-intelligence-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>SENSORY INPUT LAYER</button>
      {expanded ? <div className="market-intelligence-body">
        <p className="market-intelligence-description">Validates all market, broker, economic, sentiment, portfolio, and compliance data required before CACSMS Engine can scan assets, rank opportunities, analyze markets, and approve trades.</p>
        {props.sources.map((source) => <details className="market-source-row" key={source.id}>
          <summary aria-label={`${source.title} health: ${source.status}`}><span className="market-source-icon" style={{ color: source.color, background: `${source.color}14` }}>{source.icon}</span><span><strong>{source.title}</strong><small>{source.description}</small></span><em>{source.status}</em></summary>
          <div><b>{source.required ? "REQUIRED" : "OPTIONAL"}</b><span>Feeds: {source.feedsInto.join(", ")}</span><span>Impact: {source.failureImpact}</span></div>
        </details>)}
        <section className={`data-quality-gate ${blocked ? "blocked" : ""}`}><h3>DATA QUALITY GATE</h3><div><span>Feed Health <b>{props.dataQualityScore}%</b></span><span>Freshness <b>{props.freshnessStatus}</b></span><span>Validation <b>{props.validationStatus}</b></span><span>Critical Sources <b>{props.criticalSourcesOnline}/{props.criticalSourcesTotal} ONLINE</b></span><span>Proceed Status <b>{props.proceedStatus}</b></span></div></section>
      </div> : null}
      <div className="feeds-stage-one">FEEDS STAGE 1 <span aria-hidden="true">-&gt;</span></div>
    </article>
  );
}
