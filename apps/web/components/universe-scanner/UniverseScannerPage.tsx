import Link from "next/link";
import { scannerPages, type ScannerPageDefinition } from "../../lib/universe-scanner/scanner-pages";

const assetRows = [
  { asset: "EURUSD", side: "Buy", score: 91, confidence: 88, risk: "Low", status: "Qualified" },
  { asset: "XAUUSD", side: "Sell", score: 87, confidence: 82, risk: "Medium", status: "Watchlist" },
  { asset: "NAS100", side: "Buy", score: 84, confidence: 79, risk: "Medium", status: "Qualified" },
  { asset: "GBPJPY", side: "Sell", score: 78, confidence: 74, risk: "High", status: "Rejected" }
];

const healthRows = [
  { label: "Scanner Health", value: "Operational", meta: "18 workers online" },
  { label: "Scanner Throughput", value: "20 assets", meta: "6 timeframes each" },
  { label: "Average Opportunity Score", value: "82", meta: "qualified set" },
  { label: "Average Confidence Score", value: "79", meta: "live readiness" }
];

function BadgeList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="scanner-panel">
      <h2>{title}</h2>
      <div className="scanner-badges">
        {items.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function PipelineNav({ current }: { current: ScannerPageDefinition }) {
  return (
    <nav className="scanner-pipeline" aria-label="Universe scanner build order">
      {scannerPages.map((page) => (
        <Link className={page.slug === current.slug ? "is-active" : ""} href={page.route} key={page.slug}>
          <span>{String(page.order).padStart(2, "0")}</span>
          {page.title}
        </Link>
      ))}
    </nav>
  );
}

function DashboardSummary() {
  return (
    <>
      <section className="scanner-kpis" aria-label="Universe scanner dashboard metrics">
        {[
          ["Assets Scanned", "20", "full universe"],
          ["Qualified Opportunities", "9", "ready for ranking"],
          ["Rejected Opportunities", "4", "blocked by risk"],
          ["Elite Opportunities", "3", "score above 90"],
          ["High Risk Opportunities", "5", "watch closely"],
          ["Institutional Setups", "6", "structure aligned"],
          ["Prop Safe Opportunities", "7", "rule compliant"]
        ].map(([label, value, meta]) => (
          <article className="scanner-kpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{meta}</small>
          </article>
        ))}
      </section>
      <section className="scanner-grid scanner-grid-2">
        <div className="scanner-panel">
          <h2>Top Candidates</h2>
          <table className="scanner-table">
            <thead>
              <tr><th>Asset</th><th>Side</th><th>Score</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {assetRows.map((row) => <tr key={row.asset}><td>{row.asset}</td><td>{row.side}</td><td>{row.score}</td><td>{row.confidence}%</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="scanner-panel">
          <h2>Scanner Health</h2>
          <div className="scanner-health-list">
            {healthRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <small>{row.meta}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function UniverseScannerPage({ page }: { page: ScannerPageDefinition }) {
  const previous = scannerPages[page.order - 2];
  const next = scannerPages[page.order];
  return (
    <main className={`universe-scanner scanner-tone-${page.tone}`}>
      <section className="scanner-hero">
        <div>
          <p className="scanner-eyebrow">Card 03 / 20-Asset Universe Scanner / Step {String(page.order).padStart(2, "0")}</p>
          <h1>{page.title}</h1>
          <p>{page.purpose}</p>
        </div>
        <aside>
          <span>Route</span>
          <strong>{page.route}</strong>
          <small>{previous ? `Receives from ${previous.title}` : "Starts the Card 03 pipeline"}</small>
          <small>{next ? `Feeds ${next.title}` : "Completes scanner diagnostics"}</small>
        </aside>
      </section>

      {page.slug === "dashboard" ? <DashboardSummary /> : null}

      <section className="scanner-grid">
        <section className="scanner-panel">
          <h2>Functions</h2>
          <div className="scanner-function-grid">
            {page.functions.map((item) => <div key={item}>{item}</div>)}
          </div>
        </section>
        <section className="scanner-panel scanner-output-panel">
          <h2>Outputs</h2>
          <ul>
            {page.outputs.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </section>

      <section className="scanner-grid scanner-grid-3">
        <BadgeList title="Categories" items={page.categories} />
        <BadgeList title="Currencies" items={page.currencies} />
        <BadgeList title="Timeframes" items={page.timeframes} />
        <BadgeList title="Integrates" items={page.integrates} />
        <BadgeList title="Scores" items={page.scores} />
        <BadgeList title="Generate" items={page.generate} />
      </section>

      <section className="scanner-panel">
        <h2>Build Order</h2>
        <PipelineNav current={page} />
      </section>
    </main>
  );
}
