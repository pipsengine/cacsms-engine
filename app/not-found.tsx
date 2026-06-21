import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div>
        <p className="eyebrow">Route not registered</p>
        <h1>Command center page not found</h1>
        <p>The requested workspace is not available in the trading navigation map.</p>
        <Link className="button button-primary" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
