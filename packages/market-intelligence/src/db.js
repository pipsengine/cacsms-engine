import pg from "pg";

const { Pool } = pg;

let pool;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function assertDatabaseReady() {
  const status = await testDatabaseConnection();
  if (status.connected) return status;
  const error = new Error(status.configured ? "database_connection_failed" : "database_not_configured");
  error.details = status;
  throw error;
}

export function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL || "";
  if (!connectionString) {
    return { configured: false, database: null, user: null, host: null, port: null };
  }
  try {
    const url = new URL(connectionString);
    return {
      configured: true,
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      user: decodeURIComponent(url.username),
      host: url.hostname,
      port: url.port || "5432"
    };
  } catch {
    return { configured: true, database: null, user: null, host: null, port: null };
  }
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("database_not_configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX || 20),
      idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 15000)
    });
    pool.on("error", (error) => {
      console.error("[database] idle client error:", error.message);
    });
  }
  return pool;
}

export async function testDatabaseConnection() {
  if (!isDatabaseConfigured()) {
    return {
      status: "not_configured",
      configured: false,
      connected: false,
      message: "DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL."
    };
  }

  const config = getDatabaseConfig();
  let client;
  try {
    client = await getPool().connect();
    const { rows } = await client.query("SELECT current_database() AS database, current_user AS user, now() AS server_time");
    return {
      status: "connected",
      configured: true,
      connected: true,
      database: rows[0].database,
      user: rows[0].user,
      host: config.host,
      port: config.port,
      serverTime: rows[0].server_time,
      message: "PostgreSQL connection successful."
    };
  } catch (error) {
    return {
      status: "error",
      configured: true,
      connected: false,
      database: config.database,
      user: config.user,
      host: config.host,
      port: config.port,
      code: error.code || null,
      message: error.message,
      hint: error.code === "28P01"
        ? "Authentication failed. Run database/setup-local-postgres.sql as the postgres superuser."
        : error.code === "3D000"
          ? `Database "${config.database}" does not exist. Run database/setup-local-postgres.sql or npm run db:setup.`
          : "Verify PostgreSQL is running on the configured host and port."
    };
  } finally {
    client?.release();
  }
}

export async function query(text, params = []) {
  const poolRef = getPool();
  try {
    return await poolRef.query(text, params);
  } catch (error) {
    if (!/timeout exceeded when trying to connect/i.test(error.message)) throw error;
    return poolRef.query(text, params);
  }
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
