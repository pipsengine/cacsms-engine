namespace Cacsms.Engine.Application.Workflow;

public sealed record WorkflowOverviewDto(
    int TotalStages,
    int Completed,
    int InProgress,
    int Pending,
    int NotStarted,
    decimal OverallCompletion,
    IReadOnlyCollection<WorkflowStageDto> Stages);
