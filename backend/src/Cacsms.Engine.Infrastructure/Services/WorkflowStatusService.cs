using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Workflow;
using Cacsms.Engine.Domain.Workflow;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class WorkflowStatusService : IWorkflowStatusService
{
    private static readonly WorkflowStageDto[] Stages =
    [
        new("01", "Trading Mode Selection", TradingModule.TradeExecution, WorkflowStatus.Completed, 100),
        new("02", "Symbol Selection", TradingModule.MarketIntelligence, WorkflowStatus.Completed, 100),
        new("03", "Symbol Eligibility Check", TradingModule.MarketIntelligence, WorkflowStatus.Completed, 100),
        new("04", "Symbol Classification", TradingModule.MarketIntelligence, WorkflowStatus.Completed, 100),
        new("05", "Analysis Path Selection", TradingModule.MarketIntelligence, WorkflowStatus.Completed, 100),
        new("06A", "Institutional Analysis", TradingModule.InstitutionalEngine, WorkflowStatus.Completed, 100),
        new("06B", "Retail Analysis", TradingModule.RetailEngine, WorkflowStatus.Completed, 100),
        new("06C", "Hybrid Confluence", TradingModule.HybridConfluenceEngine, WorkflowStatus.InProgress, 65),
        new("07", "Opportunity Detection", TradingModule.AiDecisionEngine, WorkflowStatus.Pending, 20),
        new("08", "Opportunity Validation", TradingModule.AiDecisionEngine, WorkflowStatus.Completed, 100),
        new("09", "Risk Assessment", TradingModule.RiskManagement, WorkflowStatus.Completed, 100),
        new("10", "AI Decision Engine", TradingModule.AiDecisionEngine, WorkflowStatus.InProgress, 70),
        new("11", "Risk Approval", TradingModule.RiskManagement, WorkflowStatus.InProgress, 60),
        new("12", "Execution Approval", TradingModule.TradeExecution, WorkflowStatus.InProgress, 50),
        new("13", "Trade Execution / No-Trade Log", TradingModule.TradeExecution, WorkflowStatus.Pending, 10),
        new("14", "Trade Monitoring", TradingModule.TradeManagement, WorkflowStatus.Completed, 100),
        new("15", "Profit Lock Engine", TradingModule.ProfitLockEngine, WorkflowStatus.Completed, 100),
        new("16", "Risk Control", TradingModule.RiskManagement, WorkflowStatus.InProgress, 60),
        new("17", "Exit Decision", TradingModule.ExitManagement, WorkflowStatus.InProgress, 40),
        new("18", "Trade Closure", TradingModule.ExitManagement, WorkflowStatus.Pending, 15),
        new("19", "Performance Analytics", TradingModule.Reports, WorkflowStatus.InProgress, 45),
        new("20", "Learning Center", TradingModule.LearningCenter, WorkflowStatus.InProgress, 35),
        new("21", "Report Generation", TradingModule.Reports, WorkflowStatus.Pending, 20),
        new("22", "Audit Trail", TradingModule.AuditTrail, WorkflowStatus.NotStarted, 0)
    ];

    public Task<WorkflowOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var totalStages = 22;
        var overview = new WorkflowOverviewDto(
            totalStages,
            Completed: 12,
            InProgress: 6,
            Pending: 3,
            NotStarted: 1,
            OverallCompletion: 72,
            Stages);

        return Task.FromResult(overview);
    }
}
