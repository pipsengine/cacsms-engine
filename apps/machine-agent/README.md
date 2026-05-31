# Machine Agent

The machine agent is the fleet-side control plane component. It registers a machine, discovers local MT5 terminals, reports heartbeats and latency, publishes terminal health, and relays encrypted execution instructions to the EA bridge.

Target topology:

```text
CACSMS Engine -> Machine Agent -> MT5 Terminal -> EA Bridge -> Broker
```

Capacity design target: 1,000+ machines, 5,000+ MT5 terminals, and 20,000+ accounts.
