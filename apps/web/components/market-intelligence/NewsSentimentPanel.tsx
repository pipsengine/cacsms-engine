import type { NewsSentimentItem } from "../../lib/market-intelligence/types";
export function NewsSentimentPanel({ news }: { news: NewsSentimentItem[] }) { return <section className="mi-panel"><h2>News &amp; Sentiment</h2><strong>62% Risk-On</strong>{news.map((item)=><p key={item.title}>{item.title}</p>)}</section>; }
