"use client";
import { useEffect, useState } from "react";

type LiveSource = { id:string; routeSlug:string; name:string; provider:string; required:boolean; status:string; freshness:string; records:number; adapter:string; configuration:string };
type LiveDashboard = { probedAt:string; sourceMode:string; sources:LiveSource[]; gate:{workflowPermission:string;dataQualityScore:number;requiredHealthyCount:number;requiredSourceCount:number};summary:{live:number;notConfigured:number;unavailable:number} };
const titles:Record<string,string>={dashboard:"Market Intelligence Gathering Dashboard","data-sources":"Data Sources & Feed Health","market-data":"Market Data Providers","news-sentiment":"News & Sentiment Sources","economic-calendar":"Economic Calendar","social-sentiment":"Social & Community Sentiment","historical-data":"Historical Data","broker-data":"Broker Data","account-portfolio":"Account Portfolio","prop-firm-rules":"Prop Firm Rules","data-quality-gate":"Data Quality Gate"};

export function LiveMarketIntelligencePage({source}:{source:string}){
 const[data,setData]=useState<LiveDashboard>(),[error,setError]=useState("");
 const load=()=>fetch("http://localhost:8080/api/market-intelligence/live/dashboard",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`Live adapter probe failed (${r.status})`);return r.json()}).then(setData).catch(reason=>setError(reason.message));
 useEffect(load,[]);
 if(error)return <main><h1>{titles[source]||"Market Intelligence Center"}</h1><p>{error}</p><button onClick={load}>Retry Live Probe</button></main>;
 if(!data)return <main><h1>{titles[source]||"Market Intelligence Center"}</h1><p>Probing configured live adapters...</p></main>;
 const selected=data.sources.find(item=>item.routeSlug===source),rows=["dashboard","data-sources","data-quality-gate"].includes(source)?data.sources:selected?[selected]:[];
 return <main><h1>{titles[source]||"Market Intelligence Center"}</h1><p>Live adapters only. Fabricated rows: 0.</p><button onClick={load}>Refresh Live Probe</button><p>Card 1 permission: <strong>{data.gate.workflowPermission}</strong> / Quality: <strong>{data.gate.dataQualityScore}%</strong></p><table><thead><tr><th>Source</th><th>Provider</th><th>Requirement</th><th>Status</th><th>Freshness</th><th>Records</th><th>Adapter</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.provider}</td><td>{item.required?"REQUIRED":"OPTIONAL"}</td><td>{item.status}</td><td>{item.freshness}</td><td>{item.records}</td><td>{item.adapter}</td></tr>)}</tbody></table>{selected?.status==="NOT_CONFIGURED"?<section><h2>No live adapter is configured.</h2><p>{selected.configuration}</p></section>:null}</main>
}
