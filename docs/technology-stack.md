# Technology Stack Declaration

The project must remain aligned with this stack unless explicitly changed.

## Frontend

- TypeScript
- Next.js
- React
- Tailwind CSS
- ShadCN UI
- Radix UI
- Zustand
- TanStack Query
- SignalR Client
- TradingView Charts, Lightweight Charts, Recharts

## Backend

- C#
- ASP.NET Core
- Clean Architecture
- Domain-Driven Design
- Repository Pattern
- Service Layer Pattern
- Modular Monolith, microservice-ready
- ASP.NET Identity with RBAC, MFA, password policies, sessions, audit logging

## AI

- Python
- PyTorch
- Scikit-Learn
- XGBoost
- Pandas
- NumPy
- Independent API services consumed by ASP.NET Core

## Real-Time

- SignalR

## MT5 Integration

MT5 EA -> WebSocket -> C# MT5 Bridge Service -> ASP.NET Core Trading Services -> SignalR -> Frontend.

MT5 must not communicate directly with the database.

## Background Processing

- .NET Worker Services

## Reporting

- QuestPDF
- ClosedXML
- PDF, Excel, CSV

## Logging & Monitoring

- Serilog
- OpenTelemetry
- Future Grafana and Prometheus support

## Hosting

- Windows Server
- IIS

## Database

Database technology is TBD. All repositories, services, entities, and business logic must remain database-agnostic.
