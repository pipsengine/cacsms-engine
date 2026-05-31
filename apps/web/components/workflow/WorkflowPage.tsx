import { PageHeader } from "../layout/PageHeader";
import { WorkflowStageCard } from "./WorkflowStageCard";
import { workflowStages } from "../../lib/workflow/workflow-stages";

export function WorkflowPage() {
  return <main><PageHeader title="CACSMS ENGINE - END TO END WORKFLOW" subtitle="FROM MARKET INTELLIGENCE TO TRADE EXECUTION ACROSS MULTIPLE MT5 ENVIRONMENTS" /><section>{workflowStages.map((stage) => <WorkflowStageCard key={stage.number} stage={stage} />)}</section></main>;
}
