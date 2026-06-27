import { apiFetch } from "@/lib/api/client";

export type CotPositioningRow = {
  date: string;
  symbol: string;
  currencyName: string;
  displayCode: string;
  long: number;
  short: number;
  changeLong: number;
  changeShort: number;
  percentChange: number;
  netPositions: number;
  bias: "Bullish" | "Bearish" | "Neutral" | string;
};

export type CotPositioningSnapshot = {
  id: string;
  reportDate: string;
  releaseDate: string;
  reportingPeriod: string;
  dataSource: string;
  server: string;
  serverStatus: string;
  netPositionAll: number;
  totalLong: number;
  totalShort: number;
  longShortRatio: number;
  totalTraders: number;
  openInterest: number;
  totalContracts: number;
  nonCommercialNet: number;
  commercialNet: number;
  nonReportableNet: number;
  bias: string;
  institutionalSentiment: string;
  rows: CotPositioningRow[];
};

export async function getLatestCotPositioning() {
  return apiFetch<CotPositioningSnapshot>("/api/intelligence/cot-positioning/latest");
}

export async function getCotPositioningHistory(symbol?: string) {
  const query = symbol && symbol !== "ALL" ? `?symbol=${encodeURIComponent(symbol)}` : "";
  return apiFetch<CotPositioningRow[]>(`/api/intelligence/cot-positioning/history${query}`);
}

export async function saveCotPositioningSnapshot(snapshot: CotPositioningSnapshot) {
  return apiFetch<CotPositioningSnapshot>("/api/intelligence/cot-positioning/snapshots", {
    method: "POST",
    body: JSON.stringify({
      reportDate: snapshot.reportDate,
      releaseDate: snapshot.releaseDate,
      reportingPeriod: snapshot.reportingPeriod,
      dataSource: snapshot.dataSource,
      server: snapshot.server,
      serverStatus: snapshot.serverStatus,
      netPositionAll: snapshot.netPositionAll,
      totalLong: snapshot.totalLong,
      totalShort: snapshot.totalShort,
      longShortRatio: snapshot.longShortRatio,
      totalTraders: snapshot.totalTraders,
      openInterest: snapshot.openInterest,
      totalContracts: snapshot.totalContracts,
      nonCommercialNet: snapshot.nonCommercialNet,
      commercialNet: snapshot.commercialNet,
      nonReportableNet: snapshot.nonReportableNet,
      bias: snapshot.bias,
      institutionalSentiment: snapshot.institutionalSentiment,
      rows: snapshot.rows,
    }),
  });
}
