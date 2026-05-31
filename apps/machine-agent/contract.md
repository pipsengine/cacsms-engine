# Machine Agent Contract

The machine agent authenticates with a machine certificate and supports:

1. Register machine
2. Send heartbeat
3. Discover MT5 terminals
4. Launch MT5
5. Restart MT5
6. Deploy EA
7. Update EA
8. Capture screenshots
9. Monitor resources
10. Forward execution commands
11. Report broker and account health
12. Recover failed terminals

The canonical transport envelope is defined in `packages/types/contracts/machine-agent.schema.json`.
