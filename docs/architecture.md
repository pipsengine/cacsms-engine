# CACSMS Engine Architecture

## Product Character

CACSMS Engine is an enterprise command center: professional, premium, executive, institutional, AI-powered, mission-critical, data-dense, and information-rich. It uses a white-first modern SaaS visual language with the operational density of a modern Bloomberg-style terminal, institutional risk systems, mission-control software, and a restrained amount of charting UI.

## Monorepo

```text
cacsms-engine/
|-- apps/
|   |-- web
|   |-- api
|   |-- machine-agent
|   `-- mt5-bridge
|-- packages/
|   |-- ui
|   |-- workflow
|   |-- market-intelligence
|   |-- asset-scanner
|   |-- market-analysis
|   |-- vision
|   |-- ai-decision
|   |-- ai-debate
|   |-- strategy
|   |-- risk
|   |-- execution
|   |-- learning
|   |-- infrastructure
|   |-- monitoring
|   |-- reporting
|   `-- security
|-- database/
|-- infrastructure/
`-- docs/
```

## Control Flow

```text
Frontend Command Platform
  -> Workflow Orchestrator
    -> Trading Intelligence Services
      -> Risk & Governance Services
        -> Distributed MT5 Infrastructure
          -> Machine Agent + EA Bridge
            -> Broker Execution
              -> Learning + Reporting + Audit
```

The infrastructure registry models each relationship as `machine -> machine agent -> MT5 terminal -> MT5 account -> broker`, with EA bridge connections attached to terminals and accounts. The target fleet is 1,000+ machines, 5,000+ MT5 terminals, and 20,000+ accounts.

## Scanning Pipeline

The scanner begins with the seeded 20-asset universe and records each narrowing pass in `market.scan_results`:

```text
20 assets -> Top 10 -> Top 5 -> Top 3 -> Best 1-2 trades
```
