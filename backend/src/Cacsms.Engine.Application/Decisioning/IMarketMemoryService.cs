namespace Cacsms.Engine.Application.Decisioning;

public interface IMarketMemoryService
{
    MarketMemoryResponse Evaluate(MarketMemoryRequest request);
}

