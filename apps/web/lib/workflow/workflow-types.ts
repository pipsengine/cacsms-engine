export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "blocked" | "retrying" | "skipped" | "escalated" | "stopped";
export type WorkflowStage = { number: number; name: string; status: WorkflowStatus };
