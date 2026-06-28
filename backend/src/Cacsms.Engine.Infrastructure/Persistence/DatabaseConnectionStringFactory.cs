using Cacsms.Engine.Infrastructure.Persistence.Options;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Cacsms.Engine.Infrastructure.Persistence;

internal static class DatabaseConnectionStringFactory
{
    private const string PasswordEnvironmentVariable = "CACSMS_DB_PASSWORD";

    public static string Build(IConfiguration configuration, IHostEnvironment environment)
    {
        var options = configuration
            .GetSection(DatabaseOptions.SectionName)
            .Get<DatabaseOptions>() ?? new DatabaseOptions();

        var password = ResolvePassword(configuration, environment);
        if (string.IsNullOrWhiteSpace(password))
        {
            return BuildUnavailableConnectionString();
        }

        if (string.IsNullOrWhiteSpace(options.UserId))
        {
            throw new InvalidOperationException(
                $"Database user is required. Set {DatabaseOptions.SectionName}:UserId.");
        }

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = options.Server,
            InitialCatalog = options.Database,
            UserID = options.UserId,
            Password = password,
            Encrypt = options.Encrypt,
            TrustServerCertificate = options.TrustServerCertificate,
            ConnectTimeout = options.ConnectTimeoutSeconds,
            ApplicationName = "Cacsms.Engine",
            PersistSecurityInfo = false,
            MultipleActiveResultSets = false
        };

        return builder.ConnectionString;
    }

    private static string BuildUnavailableConnectionString()
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = "127.0.0.1,1",
            InitialCatalog = "CacsmsEngineUnavailable",
            IntegratedSecurity = true,
            Encrypt = false,
            TrustServerCertificate = true,
            ConnectTimeout = 1,
            ApplicationName = "Cacsms.Engine.Degraded",
            PersistSecurityInfo = false,
            MultipleActiveResultSets = false
        };

        return builder.ConnectionString;
    }

    private static string ResolvePassword(IConfiguration configuration, IHostEnvironment environment)
    {
        var configuredPassword = configuration[$"{DatabaseOptions.SectionName}:Password"];
        if (!string.IsNullOrWhiteSpace(configuredPassword))
        {
            return configuredPassword;
        }

        var environmentPassword = Environment.GetEnvironmentVariable(PasswordEnvironmentVariable);
        if (!string.IsNullOrWhiteSpace(environmentPassword))
        {
            return environmentPassword;
        }

        if (environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                $"Database password is not configured for development. Set user secret '{DatabaseOptions.SectionName}:Password' or environment variable '{PasswordEnvironmentVariable}'.");
        }

        return string.Empty;
    }
}
