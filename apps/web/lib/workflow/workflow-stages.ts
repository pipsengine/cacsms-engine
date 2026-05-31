import type { WorkflowStage } from "./workflow-types";

export const workflowStages: WorkflowStage[] = Array.from({ length: 14 }, (_, index) => ({ number: index + 1, name: `Workflow Stage ${index + 1}`, status: index < 8 ? "completed" : "pending" }));
