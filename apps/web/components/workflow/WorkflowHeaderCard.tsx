export type WorkflowHeaderProps = {
  workflowStatus: "RUNNING" | "PAUSED" | "STOPPED" | "FAILED";
  assetUniverseCount: number;
  executionMode: "SAFE MODE" | "AUTO MODE" | "MANUAL MODE" | "EMERGENCY";
  riskGateStatus: "ACTIVE" | "WARNING" | "BLOCKED";
  currentStage?: string;
  environment?: string;
  marketSession?: string;
};

const statusTone = (value: string) => value === "EMERGENCY" || value === "FAILED" || value === "BLOCKED"
  ? "danger"
  : value === "SAFE MODE" || value === "WARNING"
    ? "warning"
    : "active";

export function WorkflowHeaderCard({
  workflowStatus,
  assetUniverseCount,
  executionMode,
  riskGateStatus,
  currentStage,
  environment = "Production",
  marketSession = "London / New York Overlap"
}: WorkflowHeaderProps) {
  const indicators = [
    ["Workflow Status", workflowStatus],
    ["Asset Universe", `${assetUniverseCount} ASSETS`],
    ["Execution Mode", executionMode],
    ["Risk Gate", riskGateStatus]
  ];

  return (
    <header className="mission-control-banner">
      <div className="mission-banner-copy">
        <div className="mission-banner-classification">
          <span className="mission-banner-badge">AUTONOMOUS AI TRADING OPERATING SYSTEM</span>
          <span>MISSION CONTROL / {environment.toUpperCase()}</span>
        </div>
        <h1>CACSMS ENGINE - END-TO-END AUTONOMOUS TRADING WORKFLOW</h1>
        <p>From market intelligence, 20-asset scanning, AI decision, debate, risk validation and MT5 execution to position management, audit, learning and continuous optimization.</p>
        <div className="mission-banner-meta">
          <span>CURRENT STAGE <strong>{currentStage ?? "20-Asset Universe Scanner"}</strong></span>
          <span>MARKET SESSION <strong>{marketSession}</strong></span>
        </div>
      </div>
      <div className="mission-banner-control">
        <div className="mission-banner-indicators">
          {indicators.map(([label, value]) => (
            <div className="mission-indicator" key={label}>
              <small>{label}</small>
              <strong><i className={statusTone(value)} />{value}</strong>
            </div>
          ))}
        </div>
        <div className="mission-banner-actions">
          <button type="button">VIEW CURRENT RUN</button>
          <button type="button">START WORKFLOW</button>
          <button type="button">PAUSE WORKFLOW</button>
          <button type="button" className="emergency">EMERGENCY STOP</button>
        </div>
      </div>
    </header>
  );
}
