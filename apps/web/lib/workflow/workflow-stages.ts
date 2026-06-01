import type { WorkflowStage } from "./workflow-types";

const names = [
  "Data Sources Validation", "Market Intelligence Gathering", "20-Asset Universe Scanner", "Asset Ranking & Pair Selection",
  "Market Analysis & Context Engine", "Computer Vision & Chart Analysis", "AI Decision Engine", "AI Debate & Consensus Engine",
  "Strategy Intelligence Center", "Risk Intelligence & Capital Protection", "Execution Preparation", "Trade Execution & Order Management",
  "Position Management", "Post-Trade Analytics & Learning"
];

export const workflowStages: WorkflowStage[] = names.map((name, index) => ({ number: index + 1, name, status: index === 0 ? "running" : "pending" }));
