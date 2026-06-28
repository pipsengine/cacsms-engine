using System.Text.Json;
using Cacsms.Engine.Application.Intelligence;

namespace Cacsms.Engine.Application.Abstractions;

public interface IMt5TelemetryService
{
    CurrencyStrengthSnapshotDto? GetLatestCurrencyStrength();
    CurrencyStrengthSnapshotDto IngestHeartbeat(JsonElement heartbeat);
    DateTimeOffset? LastHeartbeatAt { get; }
}
