import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listNewsArticles } from "./news-intelligence.js";

const STORE_PATH = fileURLToPath(new URL("../../../apps/web/public/data/economic-calendar-intelligence.json", import.meta.url));
const DEFAULT_SYNC_MS = 60000;
const RELEASE_POLL_MS = 15000;
const CURRENCIES = ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD","CNY"];
const COUNTRIES = { USD:"United States",EUR:"Eurozone",GBP:"United Kingdom",JPY:"Japan",CHF:"Switzerland",CAD:"Canada",AUD:"Australia",NZD:"New Zealand",CNY:"China" };
const SOURCES = Object.freeze([{
  id: "forex-factory-weekly",
  name: "Forex Factory",
  type: "Public JSON Feed",
  url: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  enabled: true,
  scheduleMs: 60000,
  status: "PENDING",
  lastSyncAt: null,
  lastSuccessAt: null,
  latencyMs: null,
  imported: 0,
  updated: 0,
  error: null
}]);

let syncInFlight;
let loopStarted = false;
let releaseSyncInFlight;

function emptyStore() {
  return { version:1, updatedAt:null, sources:SOURCES.map(source=>({...source})), events:[], history:[], alerts:[], syncLogs:[] };
}
function readStore() {
  if (!existsSync(STORE_PATH)) return emptyStore();
  try { return { ...emptyStore(), ...JSON.parse(readFileSync(STORE_PATH,"utf8").replace(/^\uFEFF/,"")) }; } catch { return emptyStore(); }
}
function writeStore(store) {
  mkdirSync(dirname(STORE_PATH),{recursive:true});
  store.updatedAt = new Date().toISOString();
  writeFileSync(STORE_PATH,`${JSON.stringify(store,null,2)}\n`,"utf8");
  return store;
}
function hash(...values) { return createHash("sha256").update(values.join("|")).digest("hex"); }
function category(title) {
  const rules = [
    ["Central Bank",/\b(fomc|fed|ecb|boe|boj|rba|rbnz|boc|snb|rate|mpc|gov .* speaks|president .* speaks)\b/i],
    ["Inflation",/\b(cpi|ppi|inflation|prices)\b/i],
    ["Employment",/\b(employment|payroll|job|unemployment|claims|earnings)\b/i],
    ["GDP",/\b(gdp|gross domestic product)\b/i],
    ["Manufacturing",/\b(manufacturing|pmi|industrial production)\b/i],
    ["Retail Sales",/\b(retail sales|consumer credit|consumer confidence)\b/i],
    ["Housing",/\b(housing|home|mortgage|building|construction)\b/i],
    ["Trade Balance",/\b(trade balance|current account|goods trade)\b/i],
    ["Energy",/\b(oil|gas|inventories|storage)\b/i],
    ["Government",/\b(treasury|budget|bond auction|holiday)\b/i]
  ];
  return rules.find(([,pattern])=>pattern.test(title))?.[0] || "Economic Data";
}
function assetsFor(currency, title) {
  const map = {
    USD:["USD","EURUSD","GBPUSD","USDJPY","XAUUSD","US30","NAS100"],
    EUR:["EUR","EURUSD","EURGBP","EURJPY","GER40"],
    GBP:["GBP","GBPUSD","EURGBP","GBPJPY"],
    JPY:["JPY","USDJPY","EURJPY","GBPJPY"],
    CHF:["CHF","USDCHF","EURCHF"],
    CAD:["CAD","USDCAD"],
    AUD:["AUD","AUDUSD","AUDJPY"],
    NZD:["NZD","NZDUSD"],
    CNY:["CNY","AUDUSD","XAUUSD"]
  };
  const assets = [...(map[currency] || [currency])];
  if (/\b(oil|crude|inventories)\b/i.test(title)) assets.push("USOIL");
  return [...new Set(assets)];
}
function number(value) {
  const text = String(value || "").replaceAll(",","").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const multiplier = /K$/i.test(text) ? 1e3 : /M$/i.test(text) ? 1e6 : /B$/i.test(text) ? 1e9 : 1;
  return Number(match[0]) * multiplier;
}
function analyze(raw) {
  const importance = raw.impact === "Holiday" ? "LOW" : String(raw.impact || "Low").toUpperCase();
  const actualNumber = number(raw.actual);
  const forecastNumber = number(raw.forecast);
  const deviationNumber = actualNumber != null && forecastNumber != null ? actualNumber - forecastNumber : null;
  const riskScore = importance === "EXTREME" ? 95 : importance === "HIGH" ? 80 : importance === "MEDIUM" ? 55 : 25;
  const volatility = importance === "HIGH" || importance === "EXTREME" ? "HIGH" : importance === "MEDIUM" ? "MEDIUM" : "LOW";
  const potentialDirection = deviationNumber == null ? "Pending release" : deviationNumber > 0 ? `Potentially bullish ${raw.country}` : deviationNumber < 0 ? `Potentially bearish ${raw.country}` : "Neutral";
  return { importance, deviationNumber, riskScore, volatility, potentialDirection };
}
function expectsActual(raw) {
  const title=String(raw.title || raw.event || "");
  if(/\b(speaks|speech|holiday|auction|minutes|statement|report|book)\b/i.test(title))return false;
  return Boolean(String(raw.forecast || "").trim() || String(raw.previous || "").trim());
}
function deriveEventStatus(event) {
  if(event.actual)return "RELEASED";
  if(new Date(event.scheduledAt)>=new Date())return "UPCOMING";
  const releaseExpected=event.releaseExpected ?? expectsActual({title:event.event,forecast:event.forecast,previous:event.previous});
  return releaseExpected?"ACTUAL_UNAVAILABLE":"COMPLETED";
}
function presentEvent(event) {
  const releaseExpected=event.releaseExpected ?? expectsActual({title:event.event,forecast:event.forecast,previous:event.previous});
  const status=deriveEventStatus(event);
  return {
    ...event,
    releaseExpected,
    status,
    sentimentImpact:status==="ACTUAL_UNAVAILABLE"?"Actual unavailable":status==="COMPLETED"?"No numeric release expected":event.sentimentImpact
  };
}
function normalize(raw, source) {
  const analysis = analyze(raw);
  const scheduledAt = new Date(raw.date).toISOString();
  const id = hash(source.id, raw.title, raw.country, scheduledAt).slice(0,24);
  const released = raw.actual != null && String(raw.actual).trim() !== "";
  const releaseExpected=expectsActual(raw);
  const eventCategory = category(raw.title);
  const affectedAssets = assetsFor(raw.country,raw.title);
  const relatedNews = listNewsArticles({ q:`${raw.country} ${raw.title}`, limit:5 }).articles.map(article=>({ id:article.id, headline:article.headline, url:article.url, sentiment:article.sentiment, impact:article.impact }));
  return {
    id, sourceId:source.id, provider:source.name, event:raw.title, country:COUNTRIES[raw.country] || raw.country,
    currency:raw.country, category:eventCategory, scheduledAt, previous:raw.previous || "", forecast:raw.forecast || "",
    actual:raw.actual || "", deviation:analysis.deviationNumber, importance:analysis.importance,
    sentimentImpact:analysis.potentialDirection, expectedVolatility:analysis.volatility, riskScore:analysis.riskScore,
    historicalImportance:analysis.importance, affectedAssets, releaseExpected,
    status:released ? "RELEASED" : new Date(scheduledAt) < new Date() ? releaseExpected ? "ACTUAL_UNAVAILABLE" : "COMPLETED" : "UPCOMING",
    aiAnalysis:{
      summary:`${raw.title} is a ${analysis.importance.toLowerCase()} importance ${eventCategory.toLowerCase()} event for ${raw.country}.`,
      bullish:`A stronger-than-expected result may support ${raw.country} and related assets.`,
      bearish:`A weaker-than-expected result may pressure ${raw.country} and support opposing assets.`,
      neutral:"An in-line result may reduce immediate directional conviction.",
      tradingConsiderations:`Expected volatility is ${analysis.volatility.toLowerCase()}; monitor spreads and confirmation after release.`,
      riskWarnings:analysis.importance === "HIGH" ? "High-impact event: reduce risk around the release window." : "Monitor live liquidity and revisions."
    },
    propFirmRestriction:analysis.importance === "HIGH" ? { restricted:true, beforeMinutes:2, afterMinutes:2, action:"Trading may be restricted for news-sensitive prop accounts." } : { restricted:false, beforeMinutes:0, afterMinutes:0, action:"No default restriction." },
    relatedNews, releasedAt:released?new Date().toISOString():null, actualUpdatedAt:released?new Date().toISOString():null,
    updateSequence:released?1:0, lastChangedFields:released?["actual","deviation","status"]:[],
    discoveredAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
}
async function syncSource(source, store) {
  const started = performance.now();
  try {
    const response = await fetch(source.url,{cache:"no-store",signal:AbortSignal.timeout(15000),headers:{"User-Agent":"CACSMS-Economic-Calendar/1.0"}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    const existing = new Map(store.events.map(event=>[event.id,event]));
    let imported = 0, updated = 0;
    for (const raw of rows) {
      const event = normalize(raw,source);
      const before = existing.get(event.id);
      if(before?.actual&&!event.actual){
        event.actual=before.actual;event.deviation=before.deviation;event.status=before.status;event.releasedAt=before.releasedAt;
        event.actualUpdatedAt=before.actualUpdatedAt;event.releaseProvider=before.releaseProvider;event.revised=before.revised;
        event.sentimentImpact=before.sentimentImpact;
      }
      if (!before) imported += 1;
      else if (before.actual !== event.actual || before.forecast !== event.forecast || before.previous !== event.previous || before.status !== event.status) {
        updated += 1;
        store.history.unshift({ id:randomUUID(), eventId:event.id, recordedAt:new Date().toISOString(), previous:before.previous, forecast:before.forecast, actual:before.actual, status:before.status });
      }
      const changedFields = before ? ["actual","forecast","previous","status"].filter(field=>before[field]!==event[field]) : [];
      existing.set(event.id,{
        ...before,...event,
        discoveredAt:before?.discoveredAt || event.discoveredAt,
        updatedAt:changedFields.length?new Date().toISOString():before?.updatedAt || event.updatedAt,
        releasedAt:before?.releasedAt || event.releasedAt,
        actualUpdatedAt:changedFields.includes("actual")?new Date().toISOString():before?.actualUpdatedAt || event.actualUpdatedAt,
        updateSequence:Number(before?.updateSequence||0)+(changedFields.length?1:0),
        lastChangedFields:changedFields
      });
      if (!before?.actual && event.actual && ["HIGH","EXTREME"].includes(event.importance)) {
        store.alerts.unshift({id:randomUUID(),eventId:event.id,createdAt:new Date().toISOString(),level:event.importance,type:"ACTUAL_RELEASED",message:`${event.event} actual released: ${event.actual}`,acknowledged:false});
      }
    }
    store.events = [...existing.values()].sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt));
    store.history = store.history.slice(0,50000);
    return {...source,status:"ONLINE",lastSyncAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),latencyMs:Math.round(performance.now()-started),imported,updated,error:null};
  } catch(error) {
    return {...source,status:"FAILED",lastSyncAt:new Date().toISOString(),latencyMs:Math.round(performance.now()-started),imported:0,updated:0,error:error.message};
  }
}
export async function syncEconomicCalendar({force=false}={}) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async()=>{
    const store=readStore(), now=Date.now();
    const selected=store.sources.filter(source=>source.enabled&&(force||!source.lastSyncAt||now-new Date(source.lastSyncAt).getTime()>=Number(source.scheduleMs||DEFAULT_SYNC_MS)));
    const updates=await Promise.all(selected.map(source=>syncSource(source,store)));
    const byId=new Map(updates.map(source=>[source.id,source]));
    store.sources=store.sources.map(source=>byId.get(source.id)||source);
    store.alerts=store.alerts.slice(0,1000);
    store.syncLogs.unshift({id:randomUUID(),syncedAt:new Date().toISOString(),sourcesChecked:selected.length,eventsImported:updates.reduce((sum,source)=>sum+source.imported,0),eventsUpdated:updates.reduce((sum,source)=>sum+source.updated,0),failures:updates.filter(source=>source.status==="FAILED").length});
    store.syncLogs=store.syncLogs.slice(0,500);
    writeStore(store);
    return getEconomicCalendarDashboard();
  })().finally(()=>{syncInFlight=null;});
  return syncInFlight;
}
function releaseWindowActive(store) {
  const now=Date.now(), before=30*60*1000, after=4*60*60*1000;
  return store.events.some(event=>!event.actual&&new Date(event.scheduledAt).getTime()>=now-before&&new Date(event.scheduledAt).getTime()<=now+after);
}
function tradingEconomicsCredential() {
  return String(process.env.TRADING_ECONOMICS_API_KEY || process.env.ECONOMIC_CALENDAR_API_KEY || "").trim();
}
function matchReleaseEvent(store,row) {
  const currency=String(row.Currency || row.currency || "").toUpperCase();
  const name=String(row.Event || row.event || row.Category || "").trim().toLowerCase();
  const date=Date.parse(row.Date || row.date || row.ReferenceDate || "");
  return store.events.find(event=>{
    const sameCurrency=!currency||event.currency===currency;
    const sameName=name&&event.event.toLowerCase()===name;
    const nearDate=Number.isFinite(date)&&Math.abs(new Date(event.scheduledAt).getTime()-date)<12*60*60*1000;
    return sameCurrency&&sameName&&nearDate;
  });
}
function applyActualRelease(store,event,{actual,revised=null,provider="Configured Release Provider",releasedAt=new Date().toISOString()}={}) {
  const actualValue=String(actual??"").trim();
  if(!actualValue||event.actual===actualValue)return false;
  store.history.unshift({id:randomUUID(),eventId:event.id,recordedAt:new Date().toISOString(),previous:event.previous,forecast:event.forecast,actual:event.actual,status:event.status});
  event.actual=actualValue;
  event.deviation=number(actualValue)!=null&&number(event.forecast)!=null?number(actualValue)-number(event.forecast):null;
  event.status=revised?"REVISED":"RELEASED";
  event.releasedAt=releasedAt;
  event.actualUpdatedAt=new Date().toISOString();
  event.updatedAt=event.actualUpdatedAt;
  event.updateSequence=Number(event.updateSequence||0)+1;
  event.lastChangedFields=["actual","deviation","status"];
  event.releaseProvider=provider;
  if(revised)event.revised=revised;
  event.sentimentImpact=event.deviation==null?"Actual released":event.deviation>0?`Potentially bullish ${event.currency}`:event.deviation<0?`Potentially bearish ${event.currency}`:"Neutral";
  store.alerts.unshift({id:randomUUID(),eventId:event.id,createdAt:new Date().toISOString(),level:event.importance,type:revised?"ACTUAL_REVISED":"ACTUAL_RELEASED",message:`${event.event} actual ${revised?"revised":"released"}: ${event.actual}`,acknowledged:false});
  return true;
}
export function ingestEconomicActualRelease(input={}) {
  const store=readStore();
  const event=input.eventId?store.events.find(item=>item.id===input.eventId):matchReleaseEvent(store,input);
  if(!event)throw new Error("economic_event_not_found");
  if(!applyActualRelease(store,event,input))return event;
  store.history=store.history.slice(0,50000);store.alerts=store.alerts.slice(0,1000);writeStore(store);return event;
}
export async function syncEconomicActualReleases({force=false}={}) {
  if(releaseSyncInFlight)return releaseSyncInFlight;
  releaseSyncInFlight=(async()=>{
    const credential=tradingEconomicsCredential(),store=readStore();
    if(!credential)return {status:"NOT_CONFIGURED",updated:0,provider:"Trading Economics"};
    if(!force&&!releaseWindowActive(store))return {status:"IDLE",updated:0,provider:"Trading Economics"};
    const response=await fetch(`https://api.tradingeconomics.com/calendar?c=${encodeURIComponent(credential)}`,{cache:"no-store",signal:AbortSignal.timeout(15000),headers:{"User-Agent":"CACSMS-Economic-Calendar/1.0"}});
    if(!response.ok)throw new Error(`trading_economics_http_${response.status}`);
    const rows=await response.json();let updated=0;
    for(const row of rows){const event=matchReleaseEvent(store,row);if(event&&applyActualRelease(store,event,{actual:row.Actual,revised:row.Revised,provider:"Trading Economics",releasedAt:row.LastUpdate||new Date().toISOString()}))updated++;}
    if(updated)writeStore(store);
    return {status:"COMPLETED",updated,provider:"Trading Economics"};
  })().finally(()=>{releaseSyncInFlight=null;});
  return releaseSyncInFlight;
}
function rangeBounds(range="week") {
  const now=new Date(), start=new Date(now), end=new Date(now);
  if(range==="today"){start.setHours(0,0,0,0);end.setHours(23,59,59,999);}
  else if(range==="tomorrow"){start.setDate(start.getDate()+1);start.setHours(0,0,0,0);end.setTime(start.getTime());end.setHours(23,59,59,999);}
  else if(range==="upcoming"){end.setTime(now.getTime()+24*60*60*1000);}
  else {start.setDate(start.getDate()-start.getDay());start.setHours(0,0,0,0);end.setTime(start.getTime()+7*24*60*60*1000-1);}
  return {start,end};
}
export function listEconomicEvents(filters={}) {
  const store=readStore(); let events=store.events.map(presentEvent);
  const {start,end}=rangeBounds(filters.range || "week");
  events=events.filter(event=>new Date(event.scheduledAt)>=start&&new Date(event.scheduledAt)<=end);
  if(filters.currency) events=events.filter(event=>event.currency===String(filters.currency).toUpperCase());
  if(filters.impact) events=events.filter(event=>event.importance===String(filters.impact).toUpperCase());
  if(filters.category) events=events.filter(event=>event.category.toLowerCase()===String(filters.category).toLowerCase());
  if(filters.q){const q=String(filters.q).toLowerCase();events=events.filter(event=>`${event.event} ${event.currency} ${event.country} ${event.category}`.toLowerCase().includes(q));}
  const limit=Math.min(Math.max(Number(filters.limit||500),1),2000);
  return {events:events.slice(0,limit),total:events.length,sourceMode:"LIVE_PROVIDERS_ONLY"};
}
export function getEconomicCalendarDashboard() {
  const store=readStore(), today=listEconomicEvents({range:"today"}).events, upcoming=listEconomicEvents({range:"upcoming"}).events;
  const high=upcoming.filter(event=>["HIGH","EXTREME"].includes(event.importance));
  const sourcesOnline=store.sources.filter(source=>source.status==="ONLINE").length, retained=store.events.length>0;
  return {sourceMode:"LIVE_PROVIDERS_ONLY",updatedAt:store.updatedAt,status:sourcesOnline?"LIVE":retained?"SYNCED":"FAILED",sourcesOnline,sourcesTotal:store.sources.length,actualReleaseProvider:tradingEconomicsCredential()?"CONFIGURED":"NOT_CONFIGURED",actualReleasePollMs:Number(process.env.ECONOMIC_CALENDAR_RELEASE_POLL_MS||RELEASE_POLL_MS),totalEvents:store.events.length,todayEvents:today.length,highImpactToday:today.filter(event=>event.importance==="HIGH").length,mediumImpactToday:today.filter(event=>event.importance==="MEDIUM").length,lowImpactToday:today.filter(event=>event.importance==="LOW").length,centralBankEvents:today.filter(event=>event.category==="Central Bank").length,upcoming24h:upcoming.length,marketRiskLevel:high.length>=3?"ELEVATED":high.length?"MODERATE":"LOW",volatilityForecast:high.length?"HIGH":"LOW",nextHighImpact:high[0]||null};
}
export function listEconomicSources(){return {sources:readStore().sources,sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function listEconomicAlerts(){return {alerts:readStore().alerts,sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function listEconomicSyncLogs(){return {logs:readStore().syncLogs,sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function connectEconomicSource(input={}){const name=String(input.name||"").trim(),url=String(input.url||"").trim();if(!name||!url)throw new Error("economic_source_name_and_url_required");const parsed=new URL(url);if(!["http:","https:"].includes(parsed.protocol))throw new Error("economic_source_url_invalid");const store=readStore(),id=String(input.id||hash(name,url).slice(0,20)),existing=store.sources.find(source=>source.id===id||source.url===url);const source={...(existing||{}),id,name,type:String(input.type||"JSON Feed"),url,enabled:input.enabled!==false,scheduleMs:Math.max(60000,Number(input.scheduleMs||DEFAULT_SYNC_MS)),status:existing?.status||"PENDING",lastSyncAt:existing?.lastSyncAt||null,lastSuccessAt:existing?.lastSuccessAt||null,latencyMs:existing?.latencyMs||null,imported:0,updated:0,error:null};store.sources=existing?store.sources.map(item=>item.id===existing.id?source:item):[...store.sources,source];writeStore(store);return source;}
export async function testEconomicSource(sourceId){const store=readStore(),source=store.sources.find(item=>item.id===sourceId);if(!source)throw new Error("economic_source_not_found");const probeStore={...store,events:[...store.events],alerts:[...store.alerts]};const result=await syncSource(source,probeStore);return {sourceId,status:result.status,latencyMs:result.latencyMs,error:result.error,reachable:result.status==="ONLINE"};}
export function getEconomicEvent(id){const event=readStore().events.find(item=>item.id===id);return event?presentEvent(event):null;}
export function listEconomicReleaseUpdates({since=null}={}){const store=readStore(),timestamp=since?Date.parse(since):0;return {events:store.events.filter(event=>event.actualUpdatedAt&&new Date(event.actualUpdatedAt).getTime()>timestamp),serverTime:new Date().toISOString(),sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getEconomicEventHistory(id){const store=readStore(),event=store.events.find(item=>item.id===id);return {event,history:store.history.filter(item=>item.eventId===id),sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getEconomicEventCorrelation(id){const event=getEconomicEvent(id);return {eventId:id,relatedNews:event?.relatedNews||[],correlations:event?[{type:"Currency Strength",value:event.currency},{type:"News Sentiment",value:event.relatedNews?.map(item=>item.sentiment)||[]},{type:"Affected Markets",value:event.affectedAssets}]:[],sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getEconomicRestrictions(){return {restrictions:readStore().events.filter(event=>event.propFirmRestriction?.restricted).map(event=>({eventId:event.id,event:event.event,scheduledAt:event.scheduledAt,assets:event.affectedAssets,...event.propFirmRestriction,enforcement:new Date(event.scheduledAt)>new Date()?"SCHEDULED":"COMPLETED"})),sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getEconomicAssetImpact(){const map={};for(const event of readStore().events){for(const symbol of event.affectedAssets){const row=map[symbol]||{symbol,events:0,highImpact:0,riskTotal:0};row.events++;row.highImpact+=event.importance==="HIGH"?1:0;row.riskTotal+=event.riskScore;map[symbol]=row;}}return {assets:Object.values(map).map(row=>({...row,averageRiskScore:Math.round(row.riskTotal/row.events)})),sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getCentralBankEvents(){return {centralBanks:readStore().events.filter(event=>event.category==="Central Bank"),sourceMode:"LIVE_PROVIDERS_ONLY"};}
export function getEconomicCalendarLiveSourceSnapshot(){const dashboard=getEconomicCalendarDashboard(),store=readStore(),healthy=dashboard.sourcesOnline>0,retained=dashboard.totalEvents>0,available=healthy||retained;return {id:"economic-calendar",routeSlug:"economic-calendar",name:"Economic Calendar",category:"economic-calendar",subtitle:"Automated live economic-event synchronization and risk intelligence.",provider:healthy?`${dashboard.sourcesOnline} live calendar provider${dashboard.sourcesOnline===1?"":"s"}`:retained?"Retained live calendar dataset":"No reachable calendar provider",status:healthy?"LIVE":retained?"SYNCED":"FAILED",required:true,lastSyncAt:store.updatedAt,freshnessSeconds:store.updatedAt?Math.max(0,Math.round((Date.now()-new Date(store.updatedAt).getTime())/1000)):0,freshness:store.updatedAt?"LIVE DATASET":"UNAVAILABLE",healthScore:healthy?100:retained?70:0,latencyMs:store.sources[0]?.latencyMs||0,errorCount:store.sources.filter(source=>source.status==="FAILED").length,feedsStage:"Card 1",failureAction:"restricted_trading_mode",records:dashboard.totalEvents,adapter:"economic_calendar_intelligence_engine",configuration:"Live economic calendar providers with automatic revisions and actual-release tracking.",connectionLabel:"Economic Calendar Sync Engine",envKey:null,httpStatus:null,probeError:healthy?null:retained?"Provider temporarily unavailable; retained live records remain active.":"No calendar providers are currently reachable.",checks:{configured:store.sources.some(source=>source.enabled),availability:available,apiValidation:available,latency:healthy?"LIVE SYNC":retained?"RETRY PENDING":"UNAVAILABLE",freshness:store.updatedAt?"LIVE DATASET":"UNAVAILABLE",quality:available?"PASSED":"FAILED"}};}
export function createEconomicAlert(input={}){const store=readStore(),event=getEconomicEvent(input.eventId);if(!event)throw new Error("economic_event_not_found");const alert={id:randomUUID(),eventId:event.id,createdAt:new Date().toISOString(),level:input.level||event.importance,type:input.type||"BEFORE_EVENT",message:input.message||`Alert for ${event.event}`,delivery:input.delivery||["IN_APP"],acknowledged:false};store.alerts.unshift(alert);writeStore(store);return alert;}
export function reconcileEconomicEventStatuses(){const store=readStore();let updated=0;store.events=store.events.map(event=>{const presented=presentEvent(event);if(event.releaseExpected!==presented.releaseExpected||event.status!==presented.status){updated++;return {...event,releaseExpected:presented.releaseExpected,status:presented.status,sentimentImpact:presented.sentimentImpact};}return event;});if(updated)writeStore(store);return {updated};}
export function startEconomicCalendarSyncLoop({intervalMs=Number(process.env.ECONOMIC_CALENDAR_SYNC_MS||DEFAULT_SYNC_MS),releasePollMs=Number(process.env.ECONOMIC_CALENDAR_RELEASE_POLL_MS||RELEASE_POLL_MS)}={}){if(loopStarted||intervalMs<=0)return;loopStarted=true;reconcileEconomicEventStatuses();setTimeout(()=>syncEconomicCalendar({force:true}).catch(error=>console.error("[economic-calendar]",error.message)),1500);setInterval(()=>syncEconomicCalendar().catch(error=>console.error("[economic-calendar]",error.message)),intervalMs);if(releasePollMs>0)setInterval(()=>syncEconomicActualReleases().catch(error=>console.error("[economic-calendar-release]",error.message)),releasePollMs);}
