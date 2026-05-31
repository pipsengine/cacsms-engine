import { DataQualityGate } from "../../../components/market-intelligence/DataQualityGate";
import { DataSourceHealthTable } from "../../../components/market-intelligence/DataSourceHealthTable";

export default function DataSourcesFeedHealthPage() {
  return <main><h1>Data Sources &amp; Feed Health</h1><DataQualityGate /><DataSourceHealthTable /></main>;
}
