using Cacsms.Engine.Infrastructure.Persistence.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Cacsms.Engine.Infrastructure.Persistence;

public sealed class CacsmsEngineDbContextFactory : IDesignTimeDbContextFactory<CacsmsEngineDbContext>
{
    public CacsmsEngineDbContext CreateDbContext(string[] args)
    {
        var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Development";
        var basePath = Directory.GetCurrentDirectory();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environmentName}.json", optional: true)
            .AddEnvironmentVariables()
            .AddUserSecrets(typeof(CacsmsEngineDbContextFactory).Assembly, optional: true)
            .Build();

        var databaseOptions = configuration
            .GetSection(DatabaseOptions.SectionName)
            .Get<DatabaseOptions>() ?? new DatabaseOptions();

        var hostEnvironment = new DesignTimeHostEnvironment(environmentName);
        var connectionString = DatabaseConnectionStringFactory.Build(configuration, hostEnvironment);

        var optionsBuilder = new DbContextOptionsBuilder<CacsmsEngineDbContext>();
        optionsBuilder.UseSqlServer(connectionString, sql =>
        {
            sql.MigrationsAssembly(typeof(CacsmsEngineDbContext).Assembly.GetName().Name);
            sql.EnableRetryOnFailure(
                maxRetryCount: databaseOptions.MaxRetryCount,
                maxRetryDelay: TimeSpan.FromSeconds(databaseOptions.MaxRetryDelaySeconds),
                errorNumbersToAdd: null);
            sql.CommandTimeout(databaseOptions.CommandTimeoutSeconds);
        });

        return new CacsmsEngineDbContext(optionsBuilder.Options, databaseOptions);
    }

    private sealed class DesignTimeHostEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public DesignTimeHostEnvironment(string environmentName)
        {
            EnvironmentName = environmentName;
            ApplicationName = "Cacsms.Engine.DesignTime";
            ContentRootPath = Directory.GetCurrentDirectory();
        }

        public string EnvironmentName { get; set; }

        public string ApplicationName { get; set; }

        public string ContentRootPath { get; set; }

        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } =
            new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
