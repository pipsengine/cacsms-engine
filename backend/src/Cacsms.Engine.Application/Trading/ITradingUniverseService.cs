using Cacsms.Engine.Domain.Trading;

namespace Cacsms.Engine.Application.Trading;

public interface ITradingUniverseService
{
    IReadOnlyCollection<TradingSymbol> GetApprovedSymbols();
}
