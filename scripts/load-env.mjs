import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../.env", import.meta.url));

export function loadEnvFile(path = rootEnvPath) {
  if (!existsSync(path)) return { loaded: false, path };
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  return { loaded: true, path };
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function getDatabaseConfig() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    return { configured: false, connectionString: null, database: null, user: null, host: null, port: null };
  }
  try {
    const url = new URL(connectionString);
    return {
      configured: true,
      connectionString,
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      user: decodeURIComponent(url.username),
      host: url.hostname,
      port: url.port || "5432"
    };
  } catch {
    return { configured: true, connectionString, database: null, user: null, host: null, port: null };
  }
}

loadEnvFile();
