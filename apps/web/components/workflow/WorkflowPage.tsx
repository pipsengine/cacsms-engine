import { WorkflowStageCard } from "./WorkflowStageCard";
import { WorkflowHeaderCard } from "./WorkflowHeaderCard";
import { DataSourcesCard } from "./DataSourcesCard";
import { workflowStages } from "../../lib/workflow/workflow-stages";

export function WorkflowPage() {
  return <main><WorkflowHeaderCard workflowStatus="RUNNING" assetUniverseCount={20} executionMode="SAFE MODE" riskGateStatus="ACTIVE" currentStage="20-Asset Universe Scanner" /><DataSourcesCard /><section>{workflowStages.map((stage) => <WorkflowStageCard key={stage.number} stage={stage} />)}</section></main>;
}
