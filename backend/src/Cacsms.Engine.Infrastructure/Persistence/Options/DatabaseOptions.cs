namespace Cacsms.Engine.Infrastructure.Persistence.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public string Server { get; set; } = "localhost";

    public string Database { get; set; } = "db_Cacsms-Engine";

    public string UserId { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string Schema { get; set; } = "engine";

    public bool Encrypt { get; set; } = true;

    public bool TrustServerCertificate { get; set; }

    public int ConnectTimeoutSeconds { get; set; } = 30;

    public int CommandTimeoutSeconds { get; set; } = 30;

    public int MaxRetryCount { get; set; } = 3;

    public int MaxRetryDelaySeconds { get; set; } = 10;
}
