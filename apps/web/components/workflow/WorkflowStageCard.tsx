import type { WorkflowStage } from "../../lib/workflow/workflow-types";

export function WorkflowStageCard({ stage }: { stage: WorkflowStage }) {
  return <article><strong>{String(stage.number).padStart(2, "0")}</strong><h2>{stage.name}</h2><span>{stage.status}</span></article>;
}
