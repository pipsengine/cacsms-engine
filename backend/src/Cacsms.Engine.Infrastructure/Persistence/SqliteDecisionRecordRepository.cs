using Cacsms.Engine.Application.Abstractions;
using Cacsms.Engine.Domain.Decisioning;
using Microsoft.Data.Sqlite;

namespace Cacsms.Engine.Infrastructure.Persistence;

public sealed class SqliteDecisionRecordRepository : IDecisionRecordRepository
{
    private readonly string _connectionString;

    public SqliteDecisionRecordRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    public void Initialize()
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS decision_records (
                id TEXT NOT NULL PRIMARY KEY,
                created_at TEXT NOT NULL,
                symbol TEXT NOT NULL,
                trading_mode TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                direction TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                request_json TEXT NOT NULL,
                response_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS ix_decision_records_created_at
            ON decision_records (created_at DESC);
            """;
        command.ExecuteNonQuery();
    }

    public async Task AddAsync(DecisionRecord record, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO decision_records (
                id,
                created_at,
                symbol,
                trading_mode,
                recommendation,
                direction,
                confidence_score,
                request_json,
                response_json
            )
            VALUES (
                $id,
                $created_at,
                $symbol,
                $trading_mode,
                $recommendation,
                $direction,
                $confidence_score,
                $request_json,
                $response_json
            );
            """;

        command.Parameters.AddWithValue("$id", record.Id.ToString());
        command.Parameters.AddWithValue("$created_at", record.CreatedAt.UtcDateTime.ToString("O"));
        command.Parameters.AddWithValue("$symbol", record.Symbol);
        command.Parameters.AddWithValue("$trading_mode", record.TradingMode);
        command.Parameters.AddWithValue("$recommendation", record.Recommendation);
        command.Parameters.AddWithValue("$direction", record.Direction);
        command.Parameters.AddWithValue("$confidence_score", record.ConfidenceScore);
        command.Parameters.AddWithValue("$request_json", record.RequestJson);
        command.Parameters.AddWithValue("$response_json", record.ResponseJson);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<DecisionRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                id,
                created_at,
                symbol,
                trading_mode,
                recommendation,
                direction,
                confidence_score,
                request_json,
                response_json
            FROM decision_records
            WHERE id = $id
            LIMIT 1;
            """;
        command.Parameters.AddWithValue("$id", id.ToString());

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapRecord(reader);
    }

    public async Task<IReadOnlyCollection<DecisionRecord>> ListRecentAsync(
        int limit,
        CancellationToken cancellationToken = default)
    {
        var boundedLimit = Math.Clamp(limit, 1, 200);

        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                id,
                created_at,
                symbol,
                trading_mode,
                recommendation,
                direction,
                confidence_score,
                request_json,
                response_json
            FROM decision_records
            ORDER BY created_at DESC
            LIMIT $limit;
            """;
        command.Parameters.AddWithValue("$limit", boundedLimit);

        var records = new List<DecisionRecord>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            records.Add(MapRecord(reader));
        }

        return records;
    }

    private static DecisionRecord MapRecord(SqliteDataReader reader)
    {
        return DecisionRecord.FromPersistence(
            Guid.Parse(reader.GetString(0)),
            DateTimeOffset.Parse(reader.GetString(1)),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetDecimal(6),
            reader.GetString(7),
            reader.GetString(8));
    }
}
