"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  MoreVertical,
  PieChart,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getCotPositioningHistory,
  getLatestCotPositioning,
  saveCotPositioningSnapshot,
  type CotPositioningSnapshot,
  type CotPositioningRow,
} from "@/lib/api/cot-positioning";

const tabs = [
  "Overview",
  "Asset Breakdown",
  "Traders Breakdown",
  "Historical Trends",
  "Percentile Analysis",
  "Commitments Change",
  "Disaggregated Data",
];

const currencyFilters = ["ALL", "AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD", "XAU"];
const exchangeScopes = ["All Exchanges", "CME", "COMEX"];
const reportScopes = ["Futures Only", "CFTC Legacy"];
const chartRanges = ["6M", "1Y", "2Y"] as const;
const chartSeries = ["Net Position", "Long", "Short"] as const;

type AggregatePoint = {
  date: string;
  long: number;
  short: number;
  net: number;
  ratio: number;
};

export function CotPositioningBoard() {
  const [snapshot, setSnapshot] = useState<CotPositioningSnapshot | null>(null);
  const [historyRows, setHistoryRows] = useState<CotPositioningRow[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState("ALL");
  const [activeTab, setActiveTab] = useState("Overview");
  const [exchangeScope, setExchangeScope] = useState(exchangeScopes[0]);
  const [reportScope, setReportScope] = useState(reportScopes[0]);
  const [chartRange, setChartRange] = useState<(typeof chartRanges)[number]>("2Y");
  const [chartSeriesMode, setChartSeriesMode] = useState<(typeof chartSeries)[number]>("Net Position");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("Loading COT database snapshot...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getLatestCotPositioning(), getCotPositioningHistory()])
      .then(([latest, history]) => {
        if (!cancelled) {
          setSnapshot(latest);
          setHistoryRows(history);
          setStatus("Database snapshot loaded");
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setStatus(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setStatus(`Loading ${selectedCurrency === "ALL" ? "all currency" : selectedCurrency} history...`);
    getCotPositioningHistory(selectedCurrency)
      .then((history) => {
        if (!cancelled) {
          setHistoryRows(history);
          setStatus(`${selectedCurrency === "ALL" ? "All currency" : selectedCurrency} history loaded`);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setStatus(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCurrency]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toUpperCase();
    if (!search) return historyRows;

    return historyRows.filter((row) =>
      row.symbol.toUpperCase().includes(search) ||
      row.bias.toUpperCase().includes(search));
  }, [historyRows, searchTerm]);

  const visibleRows = filteredRows.slice(0, 50);
  const aggregatePoints = useMemo(() => buildAggregatePoints(historyRows), [historyRows]);
  const latestPoint = aggregatePoints.at(-1) ?? createEmptyPoint();
  const priorPoint = aggregatePoints.at(-2) ?? createEmptyPoint();

  const kpis = useMemo(() => {
    if (!snapshot) return [];

    return [
      { label: "Net Position", value: latestPoint.net, delta: formatDelta(latestPoint.net - priorPoint.net), meta: "vs Prior", icon: BarChart3, tone: "blue" },
      { label: "Total Long", value: latestPoint.long, delta: formatDelta(latestPoint.long - priorPoint.long), meta: "vs Prior", icon: TrendingUp, tone: "green" },
      { label: "Total Short", value: latestPoint.short, delta: formatDelta(latestPoint.short - priorPoint.short), meta: "vs Prior", icon: TrendingDown, tone: "red" },
      { label: "Long/Short Ratio", value: latestPoint.ratio, delta: formatDelta(latestPoint.ratio - priorPoint.ratio, 2), meta: "vs Prior", icon: PieChart, tone: "purple" },
      { label: "Total Traders", value: snapshot.totalTraders, delta: "CFTC", meta: "Latest", icon: Users, tone: "orange" },
      { label: "Open Interest", value: snapshot.openInterest, delta: "CFTC", meta: "Latest", icon: TrendingUp, tone: "cyan" },
    ];
  }, [latestPoint.long, latestPoint.net, latestPoint.ratio, latestPoint.short, priorPoint.long, priorPoint.net, priorPoint.ratio, priorPoint.short, snapshot]);

  const refreshSnapshot = async () => {
    setStatus("Refreshing latest CFTC snapshot...");
    const [latest, history] = await Promise.all([getLatestCotPositioning(), getCotPositioningHistory(selectedCurrency)]);
    setSnapshot(latest);
    setHistoryRows(history);
    setStatus(`Updated from SQL at ${formatNigeriaTime(new Date())}`);
  };

  const exportRows = async () => {
    setSaving(true);
    try {
      if (snapshot) await saveCotPositioningSnapshot(snapshot);
      downloadCsv(visibleRows, `${selectedCurrency.toLowerCase()}-cot-history-${new Date().toISOString().slice(0, 10)}.csv`);
      setStatus(`Exported ${visibleRows.length} rows at ${formatNigeriaTime(new Date())}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!snapshot) {
    return (
      <div className="cot-board">
        <section className="cot-loading-card">{status}</section>
      </div>
    );
  }

  return (
    <div className="cot-board">
      <section className="cot-toolbar">
        <FilterButton label={formatDate(snapshot.reportDate)} icon={CalendarDays} onClick={() => void refreshSnapshot()} />
        <FilterButton label={exchangeScope} onClick={() => cycleState(exchangeScopes, exchangeScope, setExchangeScope, setStatus)} />
        <FilterButton label={reportScope} onClick={() => cycleState(reportScopes, reportScope, setReportScope, setStatus)} />
        <button className="cot-export-button" onClick={exportRows} disabled={saving}>
          <Download size={16} />
          {saving ? "Exporting..." : "Export Report"}
        </button>
      </section>

      <section className="cot-kpi-grid">
        {kpis.map(({ icon: Icon, ...item }) => (
          <article className="cot-kpi-card" key={item.label}>
            <span className={`cot-icon cot-${item.tone}`}><Icon size={26} /></span>
            <div>
              <p>{item.label}</p>
              <strong>{formatMetric(item.value)}</strong>
              <small className={item.delta.startsWith("-") ? "cot-red-text" : "cot-green-text"}>{item.delta}</small>
              <em>{item.meta}</em>
            </div>
          </article>
        ))}
      </section>

      <nav className="cot-tabs" aria-label="COT sections">
        {tabs.map((tab) => (
          <button key={tab} className={tab === activeTab ? "active" : undefined} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      <section className="cot-analytics-grid">
        <article className="cot-panel cot-chart-panel">
          <PanelHeader title={`COT Net Positioning (${selectedCurrency === "ALL" ? "All Contracts" : selectedCurrency})`} info>
            <button onClick={() => cycleChartRange(chartRange, setChartRange)}>{chartRange === "2Y" ? "2 Years" : chartRange} <ChevronDown size={14} /></button>
            {chartSeries.map((series) => (
              <button key={series} className={chartSeriesMode === series ? "active" : undefined} onClick={() => setChartSeriesMode(series)}>
                {series.replace(" Position", "")}
              </button>
            ))}
            <MoreVertical size={18} />
          </PanelHeader>
          <CotPositioningChart points={aggregatePoints} range={chartRange} seriesMode={chartSeriesMode} />
        </article>

        <article className="cot-panel cot-summary-panel">
          <PanelHeader title="COT Summary (Latest)" info />
          <SummaryRows snapshot={snapshot} />
        </article>

        <article className="cot-panel cot-signal-panel">
          <PanelHeader title="Positioning Signal" />
          <div className="cot-gauge">
            <div className="cot-gauge-arc" />
            <span className="cot-needle" />
          </div>
          <strong>{snapshot.bias.toUpperCase()}</strong>
          <p>{snapshot.institutionalSentiment}</p>
          <span>Net Position: <b>{formatMetric(snapshot.netPositionAll)}</b></span>
        </article>
      </section>

      <section className="cot-panel cot-table-panel">
        <PanelHeader title="COT Data (All Contracts)" info>
          <label className="cot-table-search">
            <Search size={15} />
            <input aria-label="Search COT rows" placeholder="Search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </label>
        </PanelHeader>
        <div className="cot-currency-filter" aria-label="Currency history filters">
          {currencyFilters.map((currency) => (
            <button
              key={currency}
              className={selectedCurrency === currency ? "active" : undefined}
              onClick={() => setSelectedCurrency(currency)}
            >
              {currency === "ALL" ? "All" : currency}
            </button>
          ))}
        </div>
        <CotTable rows={visibleRows} />
        <footer className="cot-table-footer">
          <span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filteredRows.length} entries</span>
          <div>
            <button><ChevronLeft size={15} /></button>
            <button className="active">1</button>
            <button><ChevronRight size={15} /></button>
            <button>50 / page <ChevronDown size={14} /></button>
          </div>
        </footer>
      </section>

      <footer className="cot-footer">
        <span>(c) 2026 CACSMS Engine</span>
        <div>
          <span>Server: {snapshot.server}</span>
          <span>Data: {snapshot.dataSource}</span>
          <span>Latest: {formatDate(snapshot.reportDate)}</span>
        </div>
      </footer>

      <span className="cot-db-status">{status}</span>
    </div>
  );
}

function FilterButton({ label, icon: Icon, onClick }: { label: string; icon?: typeof CalendarDays; onClick?: () => void }) {
  return (
    <button className="cot-filter-button" onClick={onClick}>
      {label}
      {Icon ? <Icon size={15} /> : <ChevronDown size={15} />}
    </button>
  );
}

function PanelHeader({ title, info, children }: { title: string; info?: boolean; children?: React.ReactNode }) {
  return (
    <div className="cot-panel-header">
      <h2>{title} {info && <Info size={15} />}</h2>
      {children && <div>{children}</div>}
    </div>
  );
}

function SummaryRows({ snapshot }: { snapshot: CotPositioningSnapshot }) {
  const items = [
    ["Report Date", formatDate(snapshot.reportDate)],
    ["Release Date", formatDate(snapshot.releaseDate)],
    ["Reporting Period", snapshot.reportingPeriod],
    ["Data Source", snapshot.dataSource],
    ["Total Contracts", formatMetric(snapshot.totalContracts)],
    ["Non-Commercial Net", formatMetric(snapshot.nonCommercialNet)],
    ["Commercial Net", formatMetric(snapshot.commercialNet)],
    ["Non-Reportable Net", formatMetric(snapshot.nonReportableNet)],
  ];

  return (
    <div className="cot-summary-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong className={value.startsWith("-") ? "cot-red-text" : label.includes("Net") && !value.startsWith("-") ? "cot-green-text" : undefined}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function CotPositioningChart({
  points,
  range,
  seriesMode,
}: {
  points: AggregatePoint[];
  range: (typeof chartRanges)[number];
  seriesMode: (typeof chartSeries)[number];
}) {
  const rangeCount = range === "6M" ? 26 : range === "1Y" ? 52 : 104;
  const chartPoints = points.slice(-rangeCount);
  const maxValue = Math.max(
    1,
    ...chartPoints.flatMap((point) => [Math.abs(point.net), Math.abs(point.long), Math.abs(point.short)]));
  const monthLabels = buildMonthLabels(chartPoints);
  const netBars = chartPoints.map((point) => seriesMode === "Long" ? point.long : seriesMode === "Short" ? -point.short : point.net);
  const longPath = buildLinePath(chartPoints.map((point) => point.long), maxValue);
  const shortPath = buildLinePath(chartPoints.map((point) => point.short), maxValue);
  const netPath = buildLinePath(chartPoints.map((point) => point.net), maxValue);

  return (
    <div className="cot-chart">
      <div className="cot-chart-legend">
        <span><i className="blue" /> Net Position</span>
        <span><i className="green" /> Long Position</span>
        <span><i className="red" /> Short Position</span>
      </div>
      <div className="cot-chart-body">
        <div className="cot-axis left">
          <span>{formatCompact(maxValue)}</span>
          <span>{formatCompact(maxValue / 2)}</span>
          <span>0</span>
          <span>{formatCompact(-maxValue / 2)}</span>
          <span>{formatCompact(-maxValue)}</span>
        </div>
        <svg viewBox="0 0 980 270" aria-hidden="true">
          {(seriesMode === "Net Position" || seriesMode === "Long") && <path className={seriesMode === "Net Position" ? "interest-line" : "long-line"} d={seriesMode === "Net Position" ? netPath : longPath} />}
          {(seriesMode === "Net Position" || seriesMode === "Short") && <path className="short-line" d={seriesMode === "Net Position" ? shortPath : shortPath} />}
        </svg>
        <div className="cot-bars">
          {netBars.map((bar, index) => (
            <span
              key={`${chartPoints[index]?.date}-${index}`}
              className={bar < 0 ? "down" : undefined}
              style={{ height: `${Math.max(3, Math.abs(bar) / maxValue * 96)}px` }}
            />
          ))}
        </div>
        <div className="cot-axis right">
          <span>{formatCompact(maxValue)}</span>
          <span>{formatCompact(maxValue / 2)}</span>
          <span>0</span>
          <span>{formatCompact(-maxValue / 2)}</span>
          <span>{formatCompact(-maxValue)}</span>
        </div>
      </div>
      <div className="cot-chart-months">{monthLabels.map((month) => <span key={month}>{month}</span>)}</div>
    </div>
  );
}

function CotTable({ rows }: { rows: CotPositioningRow[] }) {
  return (
    <div className="cot-table-wrap">
      <table className="cot-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Currency</th>
            <th>Long</th>
            <th>Short</th>
            <th>Change Long</th>
            <th>Change Short</th>
            <th>% Change</th>
            <th>Net Positions</th>
            <th>Bias</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.symbol}-${row.date}`}>
              <td>{formatDate(row.date)}</td>
              <td><CurrencyLabel row={row} /></td>
              <td className="cot-blue-text">{formatMetric(row.long)}</td>
              <td className="cot-red-text">{formatMetric(row.short)}</td>
              <td className={row.changeLong < 0 ? "cot-red-text" : "cot-green-text"}>{formatChange(row.changeLong)}</td>
              <td className={row.changeShort < 0 ? "cot-red-text" : "cot-green-text"}>{formatChange(row.changeShort)}</td>
              <td className={row.percentChange < 0 ? "cot-red-text" : "cot-green-text"}>{formatSignedPercent(row.percentChange)}</td>
              <td className={row.netPositions < 0 ? "cot-red-text" : "cot-green-text"}>{formatMetric(row.netPositions)}</td>
              <td><span className={`cot-bias cot-${row.bias.toLowerCase()}`}>{row.bias}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurrencyLabel({ row }: { row: CotPositioningRow }) {
  return (
    <span className="cot-currency-cell cot-currency-symbol-only">
      <strong>{row.symbol}</strong>
    </span>
  );
}

function buildAggregatePoints(rows: CotPositioningRow[]) {
  const points = new Map<string, AggregatePoint>();

  for (const row of rows) {
    const existing = points.get(row.date) ?? { date: row.date, long: 0, short: 0, net: 0, ratio: 0 };
    existing.long += row.long;
    existing.short += Math.abs(row.short);
    existing.net += row.netPositions;
    points.set(row.date, existing);
  }

  return Array.from(points.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => ({
      ...point,
      ratio: point.short === 0 ? 0 : Number((point.long / point.short).toFixed(2)),
    }));
}

function createEmptyPoint(): AggregatePoint {
  return { date: "", long: 0, short: 0, net: 0, ratio: 0 };
}

function cycleState(
  values: string[],
  current: string,
  setValue: (value: string) => void,
  setStatus: (value: string) => void) {
  const nextValue = values[(values.indexOf(current) + 1) % values.length] ?? values[0];
  setValue(nextValue);
  setStatus(`Scope changed to ${nextValue}`);
}

function cycleChartRange(
  current: (typeof chartRanges)[number],
  setValue: (value: (typeof chartRanges)[number]) => void) {
  setValue(chartRanges[(chartRanges.indexOf(current) + 1) % chartRanges.length] ?? "2Y");
}

function downloadCsv(rows: CotPositioningRow[], filename: string) {
  const headers = ["date", "symbol", "long", "short", "changeLong", "changeShort", "percentChange", "netPositions", "bias"];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header as keyof CotPositioningRow] ?? "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildLinePath(values: number[], maxValue: number) {
  if (values.length === 0) return "";

  const width = 980;
  const height = 270;
  const mid = height / 2;
  const step = values.length === 1 ? width : width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = Number((index * step).toFixed(2));
      const y = Number((mid - (value / maxValue) * 118).toFixed(2));
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

function buildMonthLabels(points: AggregatePoint[]) {
  const labels = points
    .filter((_, index) => index % Math.max(1, Math.floor(points.length / 8)) === 0)
    .map((point) => {
      const date = new Date(`${point.date}T00:00:00`);
      return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(date);
    });

  return Array.from(new Set(labels));
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${formatMetric(value)}`;
}

function formatDelta(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNigeriaTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Lagos",
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
