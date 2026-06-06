import { WORKFLOW_STAGES } from "../../workflow/src/index.js";

export async function loadLatestWorkflowRun(client) {
  const { rows } = await client.query(`
    SELECT id, run_key, workflow_id, status, current_stage, created_at, updated_at
    FROM workflow.workflow_runs
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

async function backfillOrphanWorkflowRecords(client, runId) {
  for (const table of [
    "workflow.card_inputs",
    "workflow.card_outputs",
    "workflow.card_handoffs",
    "market.validated_intelligence_packages"
  ]) {
    await client.query(`UPDATE ${table} SET run_id = $1 WHERE run_id IS NULL`, [runId]);
  }
}

export async function ensureActiveWorkflowRun(client, { workflowId, executedAt, currentStage = 2 } = {}) {
  const existing = await loadLatestWorkflowRun(client);
  if (existing?.id) {
    await backfillOrphanWorkflowRecords(client, existing.id);
    return existing;
  }

  const stamp = (executedAt || new Date().toISOString()).replaceAll(/[-:.TZ]/g, "").slice(0, 14);
  const runKey = `WF-${stamp}`;
  const wfId = workflowId || runKey;
  const executed = executedAt || new Date().toISOString();

  const { rows } = await client.query(`
    INSERT INTO workflow.workflow_runs (run_key, workflow_id, status, current_stage, started_at, context)
    VALUES ($1, $2, 'running', $3, $4::timestamptz, $5::jsonb)
    RETURNING id, run_key, workflow_id, status, current_stage, created_at, updated_at
  `, [runKey, wfId, currentStage, executed, JSON.stringify({ source: "card_1_handoff", card1TestId: workflowId || null })]);

  const run = rows[0];
  for (const stage of WORKFLOW_STAGES) {
    let status = "pending";
    let startedAt = null;
    let completedAt = null;
    if (stage.order === 1) {
      status = "completed";
      startedAt = executed;
      completedAt = executed;
    } else if (stage.order === 2) {
      status = "running";
      startedAt = executed;
    }
    await client.query(`
      INSERT INTO workflow.workflow_stages (run_id, stage_key, stage_order, name, status, started_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
      ON CONFLICT (run_id, stage_order) DO NOTHING
    `, [run.id, stage.key, stage.order, stage.name, status, startedAt, completedAt]);
  }

  await backfillOrphanWorkflowRecords(client, run.id);
  return run;
}
