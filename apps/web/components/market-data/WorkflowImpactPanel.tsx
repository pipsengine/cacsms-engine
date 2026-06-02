export function WorkflowImpactPanel({ impacts }: { impacts: Array<{ stage: string; target: string; impact: string }> }) {
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Workflow Impact Panel</h2><b>STOP WORKFLOW ON FAILURE</b></div>
      <div className="mdoc-workflow">
        {impacts.map((item) => (
          <article key={item.stage}><strong>Market Data</strong><span>{item.target}</span><small>{item.impact}</small></article>
        ))}
      </div>
    </section>
  );
}
