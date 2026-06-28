using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Application.Workflow;
using Cacsms.Engine.Domain.Abstractions;
using Cacsms.Engine.Domain.Workflow;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class WorkflowStatusService(IRepository<WorkflowStage> workflowStages) : IWorkflowStatusService
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
}
