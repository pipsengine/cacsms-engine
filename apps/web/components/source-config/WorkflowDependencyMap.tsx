import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

export function WorkflowDependencyMap({ dependencies }: { dependencies: SourceConfigurationDashboard["workflowDependencies"] }) {
  return (
    <section className="sc-panel">
      <div className="sc-panel-head"><h2>Workflow Dependency Map</h2><b>DOWNSTREAM IMPACT</b></div>
      <div className="sc-dependency-map">
        {dependencies.map((item) => (
          <article key={item.source}>
            <strong>{item.source}</strong>
            <div>{item.targets.map((target) => <span key={target}>{target}</span>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
