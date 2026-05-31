import type { IntelligenceTimelineEvent } from "../../lib/market-intelligence/types";
export function IntelligenceFeedTimeline({ events }: { events: IntelligenceTimelineEvent[] }) { return <section className="mi-panel"><h2>Intelligence Feed Timeline</h2>{events.map((event)=><p key={`${event.time}-${event.event}`}>{event.time} / {event.event}</p>)}</section>; }
