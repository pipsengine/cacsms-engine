# Operational Foundation Coverage

This map covers the first production-ready operational workflow specification.

| Section | Implementation |
|---|---|
| Project setup | Existing monorepo boundaries cover `apps`, `services`, `packages`, `database`, `mt5`, `infrastructure`, and `docs`. The target stack is recorded in `docs/technology-stack.md`. |
| Design system | White-first institutional tokens, dense cards, borders, shadows, and mission-control composition live in `apps/web/styles.css` and `apps/web/workflow.css`. |
| Application shell | The 72px top navigation, 320px/80px sidebar, workspace, and status bars are implemented in the web app. |
| Authentication and RBAC | `003_operational_workflow_foundation.sql` adds auth RBAC tables and protected Super Administrator triggers. `002_operational_defaults.sql` seeds nine roles and ten permissions. |
| Database foundation | The three ordered migrations create all requested schemas and operational tables. |
| Twenty-asset universe | `001_asset_universe.sql` seeds all twenty assets with metadata and explicit Phase 1/Phase 2 universe membership. |
| Workflow orchestrator | `packages/workflow` implements the exact fourteen stages, nine statuses, workflow shape, mock funnel, and absolute risk veto. |
| End-to-End Workflow page | `/workflow/end-to-end` renders the complete three-column autonomous operations view. |
| Data sources | Rendered in the left workflow column. |
| Infrastructure layer | Rendered below data sources. |
| Center workflow pipeline | All fourteen stage cards include output, status, continuation, and rejection relationship. |
| Reject and stop conditions | All stage-specific reasons render in the red-bordered right panel. |
| Asset universe panel | Tier 1 and Tier 2 assets render in the right column. |
| Audit trail and reporting | Rendered in the bottom horizontal panel. |
| Final outcome | Rendered beside the audit panel. |
| Key points | Rendered in the bottom governance strip. |
| API endpoints | All requested routes exist in both the local Node validation server and the FastAPI target. See `docs/api.md`. |
| Real-time events | `/ws/workflow` exists in both servers. The thirteen event types are exported from `packages/workflow/src/mock-data.js`. |
| Mock data | Shared mock universe, ranking, Top 10, Top 5, Top 3, and execution candidates live in `packages/workflow/src/mock-data.js`. |
