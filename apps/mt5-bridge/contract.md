# EA Bridge Contract

The EA bridge validates signed execution tokens before accepting `open`, `modify`, `close`, `partial_close`, `move_sl_tp`, `breakeven`, or `trailing_stop` commands.

It emits position updates, account updates, heartbeats, and execution results. The canonical signed-command envelope is defined in `packages/types/contracts/ea-bridge.schema.json`.
