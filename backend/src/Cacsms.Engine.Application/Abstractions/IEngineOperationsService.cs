using Cacsms.Engine.Application.Operations;

namespace Cacsms.Engine.Application.Abstractions;

public interface IEngineOperationsService
{
    EngineRuntimeStatusDto GetStatus();
    EngineRuntimeStatusDto Start(string reason);
    EngineRuntimeStatusDto Stop(string reason);
    RuntimeConfigDto GetRuntimeConfig();
    RuntimeConfigDto ReloadRuntimeConfig();
    Task<DataSourcesOverviewDto> GetDataSourcesAsync(CancellationToken cancellationToken = default);
    SymbolSelectionRulesOverviewDto GetSymbolSelectionRules();
    Task<BridgeSettingsOverviewDto> GetBridgeSettingsAsync(CancellationToken cancellationToken = default);
}
