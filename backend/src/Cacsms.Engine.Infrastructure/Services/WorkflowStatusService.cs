using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Workflow;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Domain.Workflow;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class WorkflowStatusService(
    IRepository<WorkflowStage> workflowStages,
    IEngineOperationsService engineOperationsService) : IWorkflowStatusService
{
    public async Task<WorkflowOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        IReadOnlyCollection<WorkflowStage> stages;
        try
        {
            stages = await workflowStages.ListAsync(cancellationToken);
        }
        catch (InvalidOperationException)
        {
            stages = Array.Empty<WorkflowStage>();
        }

        var stageDtos = stages
            .OrderBy(stage => stage.Code, StringComparer.OrdinalIgnoreCase)
            .Select(stage => new WorkflowStageDto(
                stage.Code,
                stage.Name,
                stage.Module,
                stage.Status,
                stage.Progress))
            .ToArray();

        if (stageDtos.Length == 0)
        {
            stageDtos = await BuildLiveFoundationStagesAsync(cancellationToken);
        }

        var totalStages = stageDtos.Length;
        var overallCompletion = totalStages == 0
            ? 0
            : Math.Round(stageDtos.Average(stage => stage.Progress), 2, MidpointRounding.AwayFromZero);

        return new WorkflowOverviewDto(
            totalStages,
            Completed: stageDtos.Count(stage => stage.Status == WorkflowStatus.Completed),
            InProgress: stageDtos.Count(stage => stage.Status == WorkflowStatus.InProgress),
            Pending: stageDtos.Count(stage => stage.Status == WorkflowStatus.Pending),
            NotStarted: stageDtos.Count(stage => stage.Status == WorkflowStatus.NotStarted),
            OverallCompletion: Convert.ToDecimal(overallCompletion),
            stageDtos);
    }

    private async Task<WorkflowStageDto[]> BuildLiveFoundationStagesAsync(CancellationToken cancellationToken)
    {
        var engine = engineOperationsService.GetStatus();
        var runtime = engineOperationsService.GetRuntimeConfig();
        var dataSources = await engineOperationsService.GetDataSourcesAsync(cancellationToken);
        var currencyStrength = dataSources.Sources.FirstOrDefault(source => source.Code.Equals("CURRENCY_STRENGTH", StringComparison.OrdinalIgnoreCase));

        var runtimeConfigured = !runtime.RiskProfile.Equals("NotConfigured", StringComparison.OrdinalIgnoreCase)
            && runtime.MaxRiskPerTradePercent > 0
            && runtime.DailyDrawdownLimitPercent > 0;

        var criticalSources = dataSources.Sources
            .Where(source => source.Code is "SQL" or "MT5" or "CURRENCY_STRENGTH")
            .ToArray();
        var criticalHealthy = criticalSources.Count(source => source.IsHealthy);
        var dataSourceProgress = criticalSources.Length > 0
            ? Convert.ToInt32(Math.Round((decimal)criticalHealthy / criticalSources.Length * 100m, MidpointRounding.AwayFromZero))
            : 0;

        return
        [
            new WorkflowStageDto(
                "01",
                "Start Engine",
                TradingModule.SystemMonitoring,
                engine.State.Equals("RUNNING", StringComparison.OrdinalIgnoreCase) ? WorkflowStatus.Completed : WorkflowStatus.NotStarted,
                engine.State.Equals("RUNNING", StringComparison.OrdinalIgnoreCase) ? 100 : 0),
            new WorkflowStageDto(
                "02",
                "Load Runtime + Risk Config",
                TradingModule.RiskManagement,
                runtimeConfigured ? WorkflowStatus.Completed : WorkflowStatus.Pending,
                runtimeConfigured ? 100 : 25),
            new WorkflowStageDto(
                "03",
                "Verify Data Sources",
                TradingModule.SystemMonitoring,
                dataSourceProgress == 100 ? WorkflowStatus.Completed : criticalSources.Any(source => !source.IsHealthy) ? WorkflowStatus.Blocked : WorkflowStatus.InProgress,
                Math.Clamp(dataSourceProgress, 0, 100)),
            new WorkflowStageDto(
                "04",
                "Currency Strength Matrix",
                TradingModule.MarketIntelligence,
                currencyStrength?.IsHealthy == true ? WorkflowStatus.Completed : WorkflowStatus.Pending,
                currencyStrength?.IsHealthy == true ? 100 : 0),
        ];
    }
}
