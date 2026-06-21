using Cacsms.Engine.Application.Trading;
using Cacsms.Engine.Domain.Trading;

namespace Cacsms.Engine.Infrastructure.Services;

public sealed class TradingUniverseService : ITradingUniverseService
{
    public IReadOnlyCollection<TradingSymbol> GetApprovedSymbols()
    {
        return TradingSymbol.Approved;
    }
}
