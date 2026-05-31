import type { BrokerFeedHealth } from "../../lib/market-intelligence/types";
export function BrokerAccountFeedPanel({ feeds }: { feeds: BrokerFeedHealth[] }) { return <section className="mi-panel"><h2>Broker &amp; Account Feed</h2><strong>Broker Health 97% / Portfolio Sync Live</strong>{feeds.map((feed)=><p key={feed.broker}>{feed.broker}: {feed.executionReadiness}</p>)}</section>; }
