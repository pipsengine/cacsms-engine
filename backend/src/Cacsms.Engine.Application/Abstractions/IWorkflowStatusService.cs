using Cacsms.Engine.Application.Workflow;

namespace Cacsms.Engine.Application.Abstractions;

public interface IWorkflowStatusService
{
    Task<WorkflowOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
}
