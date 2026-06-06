import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query } from "./db.js";
import { appendLog } from "./market-data-repository.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const mt5Root = join(repoRoot, "mt5");
const manifestPath = join(mt5Root, "deploy-manifest.json");

export const EA_DEPLOY_STATUSES = Object.freeze(["PENDING", "DEPLOYING", "DEPLOYED", "VERIFIED", "FAILED", "ROLLBACK_REQUIRED"]);

function loadManifestFromDisk() {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  return { version: raw.version, files: raw.files || [] };
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function buildManifestChecksums(manifest = loadManifestFromDisk()) {
  return manifest.files.map((entry) => {
    const normalized = join(mt5Root, ...entry.source.split("/"));
    const checksum = existsSync(normalized) ? sha256File(normalized) : null;
    return { ...entry, sourcePath: normalized, sourceChecksum: checksum };
  });
}

export async function ensureEaVersionCatalog() {
  if (!isDatabaseConfigured()) return null;
  const manifest = loadManifestFromDisk();
  const files = buildManifestChecksums(manifest).map((row) => ({
    source: row.source,
    target: row.target,
    sourceChecksum: row.sourceChecksum
  }));
  await query(`UPDATE infrastructure.ea_versions SET active = false WHERE active = true`);
  const { rows } = await query(
    `INSERT INTO infrastructure.ea_versions (version, release_notes, manifest, active)
     VALUES ($1, $2, $3::jsonb, true)
     ON CONFLICT (version) DO UPDATE SET manifest = EXCLUDED.manifest, active = true, release_notes = EXCLUDED.release_notes
     RETURNING *`,
    [manifest.version, "Automatic CACSMS EA sync and deployment", JSON.stringify(files)]
  );
  return rows[0];
}

async function appendDeploymentLog(deploymentId, message, { level = "info", details = {} } = {}) {
  if (!isDatabaseConfigured()) return;
  await query(
    `INSERT INTO infrastructure.ea_deployment_logs (deployment_id, level, message, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [deploymentId, level, message, JSON.stringify(details)]
  );
}

function discoverWindowsMt5DataFolders() {
  if (process.platform !== "win32") return [];
  const appData = process.env.APPDATA;
  if (!appData) return [];
  const terminalRoot = join(appData, "MetaQuotes", "Terminal");
  if (!existsSync(terminalRoot)) return [];

  const discovered = [];
  for (const entry of readdirSync(terminalRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dataPath = join(terminalRoot, entry.name);
    const mql5Path = join(dataPath, "MQL5");
    if (!existsSync(mql5Path)) continue;
    const originPath = join(dataPath, "origin.txt");
    let origin = "";
    if (existsSync(originPath)) origin = readFileSync(originPath, "utf8").trim();
    discovered.push({
      terminalInstallId: entry.name,
      dataPath,
      expertsPath: join(mql5Path, "Experts"),
      includePath: join(mql5Path, "Include"),
      scriptsPath: join(mql5Path, "Scripts"),
      presetsPath: join(mql5Path, "Presets"),
      templatesPath: join(dataPath, "Profiles", "Templates"),
      origin
    });
  }
  return discovered;
}

export function discoverMt5TerminalPaths() {
  return discoverWindowsMt5DataFolders();
}

function resolveTargetPath(dataPath, relativeTarget) {
  return join(dataPath, ...relativeTarget.split("/"));
}

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function backupFile(filePath, backupRoot) {
  if (!existsSync(filePath)) return null;
  const backupPath = join(backupRoot, basename(filePath));
  ensureParentDir(backupPath);
  copyFileSync(filePath, backupPath);
  return { original: filePath, backup: backupPath, checksum: sha256File(filePath) };
}

function verifyNavigatorAvailability(dataPath) {
  const sourcePath = join(dataPath, "MQL5", "Experts", "CACSMS", "CACSMS_Engine_Bridge.mq5");
  const binaryPath = join(dataPath, "MQL5", "Experts", "CACSMS", "CACSMS_Engine_Bridge.ex5");
  return existsSync(sourcePath) && existsSync(binaryPath) && statSync(binaryPath).mtimeMs >= statSync(sourcePath).mtimeMs;
}

function findMetaEditor() {
  if (process.platform !== "win32") return null;
  for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.toLowerCase().startsWith("metatrader")) continue;
      const candidate = join(root, entry.name, "MetaEditor64.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function compileBridge(dataPath) {
  const sourcePath = join(dataPath, "MQL5", "Experts", "CACSMS", "CACSMS_Engine_Bridge.mq5");
  const editor = findMetaEditor();
  if (!existsSync(sourcePath)) return { ok: false, error: `Missing bridge source: ${sourcePath}` };
  if (!editor) return { ok: false, error: "MetaEditor64.exe not found" };
  const logPath = join(dirname(sourcePath), `CACSMS_Engine_Bridge.compile-${Date.now()}.log`);
  const result = spawnSync(editor, [`/compile:"${sourcePath}"`, `/log:"${logPath}"`], {
    encoding: "utf8",
    timeout: 60000,
    windowsHide: true,
    windowsVerbatimArguments: true
  });
  const compilerLogBytes = existsSync(logPath) ? readFileSync(logPath) : Buffer.alloc(0);
  const compilerLog = compilerLogBytes[0] === 0xff && compilerLogBytes[1] === 0xfe
    ? compilerLogBytes.toString("utf16le")
    : compilerLogBytes.toString("utf8");
  const compiled = verifyNavigatorAvailability(dataPath) && /Result:\s+0 errors?,\s+0 warnings?/i.test(compilerLog);
  return {
    ok: compiled,
    error: result.error?.message || (compiled ? null : "Compiled bridge binary was not refreshed"),
    editor,
    logPath,
    exitCode: result.status
  };
}

function tryRefreshMt5() {
  if (process.platform !== "win32") return { refreshed: false, reason: "not_windows" };
  const candidates = [
    join(process.env.ProgramFiles || "C:\\Program Files", "MetaTrader 5", "terminal64.exe"),
    join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "MetaTrader 5", "terminal64.exe")
  ];
  const exe = candidates.find((path) => existsSync(path));
  if (!exe) return { refreshed: false, reason: "terminal_not_found" };
  spawnSync(exe, ["/portable"], { detached: true, stdio: "ignore", windowsHide: true });
  return { refreshed: true, executable: exe };
}

function runPythonDeployAction(action, dataPath, deploymentId) {
  const script = join(repoRoot, "apps", "machine-agent", "src", "deploy_cli.py");
  if (!existsSync(script)) return null;
  const result = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [script, "--action", action, "--data-path", dataPath, "--repo-root", repoRoot, "--deployment-id", deploymentId || ""],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.error) return null;
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr };
  }
}

function executeLocalFileDeployment({ dataPath, backupRoot, manifest, action, rollbackSnapshots = [] }) {
  const manifestRows = buildManifestChecksums(manifest);
  const snapshots = [];
  const deployedFiles = [];
  const errors = [];

  if (action === "rollback") {
    for (const snapshot of rollbackSnapshots) {
      if (snapshot.backup && snapshot.original && existsSync(snapshot.backup)) {
        ensureParentDir(snapshot.original);
        copyFileSync(snapshot.backup, snapshot.original);
      }
    }
    return {
      ok: true,
      errors: [],
      deployedFiles: [],
      snapshots: rollbackSnapshots,
      navigatorVerified: verifyNavigatorAvailability(dataPath),
      refresh: { refreshed: false },
      detectedVersion: manifest.version
    };
  }

  for (const row of manifestRows) {
    if (!row.sourceChecksum) {
      errors.push(`Missing source file: ${row.source}`);
      continue;
    }
    const targetPath = resolveTargetPath(dataPath, row.target);
    ensureParentDir(targetPath);
    if (action !== "verify" && existsSync(targetPath)) {
      const snapshot = backupFile(targetPath, backupRoot);
      if (snapshot) snapshots.push(snapshot);
    }
    if (action === "verify") {
      const targetChecksum = existsSync(targetPath) ? sha256File(targetPath) : null;
      deployedFiles.push({
        relativePath: row.target,
        targetPath,
        sourceChecksum: row.sourceChecksum,
        targetChecksum,
        status: targetChecksum === row.sourceChecksum ? "VERIFIED" : "MISMATCH"
      });
      if (targetChecksum !== row.sourceChecksum) errors.push(`Checksum mismatch: ${row.target}`);
      continue;
    }
    copyFileSync(row.sourcePath, targetPath);
    const targetChecksum = sha256File(targetPath);
    const ok = targetChecksum === row.sourceChecksum;
    deployedFiles.push({
      relativePath: row.target,
      targetPath,
      sourceChecksum: row.sourceChecksum,
      targetChecksum,
      status: ok ? "DEPLOYED" : "FAILED"
    });
    if (!ok) errors.push(`Post-copy checksum mismatch: ${row.target}`);
  }

  let compilation = null;
  if ((action === "deploy" || action === "update") && !errors.length) {
    compilation = compileBridge(dataPath);
    if (!compilation.ok) errors.push(compilation.error);
  }

  const navigatorVerified = verifyNavigatorAvailability(dataPath);
  const refresh = action === "deploy" || action === "update" ? tryRefreshMt5() : { refreshed: false };
  return {
    ok: errors.length === 0,
    errors,
    deployedFiles,
    snapshots,
    navigatorVerified,
    compilation,
    refresh,
    detectedVersion: manifest.version
  };
}

function normalizeOrigin(origin = "") {
  return origin.replaceAll("\u0000", "").replace(/\s+/g, " ").trim().toLowerCase();
}

function terminalMatchesFolder(terminal, folder) {
  const origin = normalizeOrigin(folder.origin);
  const broker = String(terminal.broker_name || terminal.provider_name || "").toLowerCase();
  if (origin && broker && origin.includes("ic markets") && broker.includes("ic markets")) return true;
  if (origin && broker && origin.includes(broker.split(" ")[0])) return true;
  return false;
}

function pickTerminalForFolder(unlinkedTerminals, folder) {
  if (!unlinkedTerminals.length) return null;
  const matched = unlinkedTerminals.filter((terminal) => terminalMatchesFolder(terminal, folder));
  const preferred = matched.find((terminal) => !String(terminal.provider_name || "").toLowerCase().includes("test"))
    || matched[0];
  if (preferred) return preferred;
  return unlinkedTerminals.find((terminal) => !String(terminal.provider_name || "").toLowerCase().includes("test"))
    || unlinkedTerminals[0];
}

function resolveTerminalInstallId(dataPath, storedInstallId) {
  if (storedInstallId) return storedInstallId;
  if (!dataPath) return null;
  return basename(dataPath);
}

async function backfillMissingTerminalInstallIds() {
  const { rows } = await query(
    `SELECT terminal_id, data_path
     FROM infrastructure.mt5_terminal_paths
     WHERE terminal_install_id IS NULL AND data_path IS NOT NULL`
  );
  for (const row of rows) {
    await query(
      `UPDATE infrastructure.mt5_terminal_paths
       SET terminal_install_id = $1, updated_at = now()
       WHERE terminal_id = $2`,
      [basename(row.data_path), row.terminal_id]
    );
  }
  return rows.length;
}

export async function ensureTerminalPathLinks() {
  if (!isDatabaseConfigured()) {
    return { discovered: discoverMt5TerminalPaths(), linked: [], synced: 0 };
  }

  await backfillMissingTerminalInstallIds();
  const discovered = discoverWindowsMt5DataFolders();
  const { rows: unlinkedTerminals } = await query(
    `SELECT t.id, t.terminal_name, t.broker_name, t.machine_id, p.name AS provider_name
     FROM infrastructure.mt5_terminals t
     LEFT JOIN infrastructure.mt5_terminal_paths path ON path.terminal_id = t.id
     LEFT JOIN market.market_data_providers p ON p.id = t.provider_id
     WHERE path.terminal_id IS NULL
     ORDER BY t.created_at DESC`
  );

  const linked = [];
  const remaining = [...unlinkedTerminals];

  for (const folder of discovered) {
    const { rows: existing } = await query(
      `SELECT terminal_id FROM infrastructure.mt5_terminal_paths WHERE terminal_install_id = $1`,
      [folder.terminalInstallId]
    );
    if (existing.length) continue;

    const terminal = pickTerminalForFolder(remaining, folder);
    if (!terminal?.machine_id) continue;

    await upsertTerminalPaths(terminal.id, terminal.machine_id, folder);
    linked.push({
      terminalId: terminal.id,
      terminalName: terminal.terminal_name,
      terminalInstallId: folder.terminalInstallId,
      dataPath: folder.dataPath
    });
    const index = remaining.findIndex((item) => item.id === terminal.id);
    if (index >= 0) remaining.splice(index, 1);
  }

  return { discovered, linked, synced: linked.length };
}

async function upsertTerminalPaths(terminalId, machineId, folder) {
  await query(
    `INSERT INTO infrastructure.mt5_terminal_paths (
      terminal_id, machine_id, data_path, experts_path, include_path, scripts_path, templates_path, presets_path, terminal_install_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
    ON CONFLICT (terminal_id) DO UPDATE SET
      machine_id = EXCLUDED.machine_id,
      data_path = EXCLUDED.data_path,
      experts_path = EXCLUDED.experts_path,
      include_path = EXCLUDED.include_path,
      scripts_path = EXCLUDED.scripts_path,
      templates_path = EXCLUDED.templates_path,
      presets_path = EXCLUDED.presets_path,
      terminal_install_id = EXCLUDED.terminal_install_id,
      updated_at = now()
    RETURNING *`,
    [
      terminalId,
      machineId,
      folder.dataPath,
      folder.expertsPath,
      folder.includePath,
      folder.scriptsPath,
      folder.templatesPath,
      folder.presetsPath,
      folder.terminalInstallId
    ]
  );
}

async function resolveTerminalFolder(terminalId, machineId, { dataPath = null } = {}) {
  if (dataPath) {
    const folder = {
      terminalInstallId: basename(dataPath),
      dataPath,
      expertsPath: join(dataPath, "MQL5", "Experts"),
      includePath: join(dataPath, "MQL5", "Include"),
      scriptsPath: join(dataPath, "MQL5", "Scripts"),
      presetsPath: join(dataPath, "MQL5", "Presets"),
      templatesPath: join(dataPath, "Profiles", "Templates")
    };
    await upsertTerminalPaths(terminalId, machineId, folder);
    return folder;
  }

  const { rows } = await query(`SELECT * FROM infrastructure.mt5_terminal_paths WHERE terminal_id = $1`, [terminalId]);
  if (rows[0]) {
    return {
      terminalInstallId: rows[0].terminal_install_id,
      dataPath: rows[0].data_path,
      expertsPath: rows[0].experts_path,
      includePath: rows[0].include_path,
      scriptsPath: rows[0].scripts_path,
      templatesPath: rows[0].templates_path,
      presetsPath: rows[0].presets_path
    };
  }

  const discovered = discoverWindowsMt5DataFolders();
  if (!discovered.length) throw new Error("mt5_terminal_paths_not_found");
  const folder = discovered[0];
  await upsertTerminalPaths(terminalId, machineId, folder);
  return folder;
}

async function getActiveVersion() {
  await ensureEaVersionCatalog();
  const { rows } = await query(`SELECT * FROM infrastructure.ea_versions WHERE active = true ORDER BY created_at DESC LIMIT 1`);
  if (!rows[0]) throw new Error("ea_version_not_found");
  return rows[0];
}

async function getTerminalContext(terminalId) {
  const { rows } = await query(
    `SELECT t.*, m.name AS machine_name FROM infrastructure.mt5_terminals t
     LEFT JOIN infrastructure.machines m ON m.id = t.machine_id
     WHERE t.id = $1`,
    [terminalId]
  );
  if (!rows[0]) throw new Error("terminal_not_found");
  return rows[0];
}

async function createDeploymentRecord({ terminalId, machineId, versionRow, status = "PENDING" }) {
  const { rows } = await query(
    `INSERT INTO infrastructure.ea_deployments (machine_id, terminal_id, version_id, status, ea_version, started_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING *`,
    [machineId, terminalId, versionRow.id, status, versionRow.version]
  );
  return rows[0];
}

async function finalizeDeployment(deploymentId, patch) {
  const { rows } = await query(
    `UPDATE infrastructure.ea_deployments SET
      status = COALESCE($2, status),
      navigator_verified = COALESCE($3, navigator_verified),
      checksum_verified = COALESCE($4, checksum_verified),
      rollback_snapshot = COALESCE($5::jsonb, rollback_snapshot),
      error_message = $6,
      completed_at = now(),
      updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      deploymentId,
      patch.status,
      patch.navigatorVerified,
      patch.checksumVerified,
      patch.rollbackSnapshot ? JSON.stringify(patch.rollbackSnapshot) : null,
      patch.errorMessage || null
    ]
  );
  return rows[0];
}

async function persistDeploymentFiles(deploymentId, files) {
  for (const file of files) {
    await query(
      `INSERT INTO infrastructure.ea_deployment_files (deployment_id, relative_path, target_path, source_checksum, target_checksum, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [deploymentId, file.relativePath, file.targetPath, file.sourceChecksum, file.targetChecksum, file.status]
    );
  }
}

async function markEaInstalled(terminalId, providerId, version) {
  await query(
    `UPDATE infrastructure.mt5_terminals SET ea_version = $2, ea_status = 'INSTALLED', updated_at = now(),
      onboarding = COALESCE(onboarding, '{}'::jsonb) || '{"ea_installed":"completed","ea_connected":"in_progress"}'::jsonb
     WHERE id = $1`,
    [terminalId, version]
  );
  await query(
    `INSERT INTO infrastructure.ea_connections (terminal_id, provider_id, ea_version, status, installed_at, last_update_at)
     VALUES ($1, $2, $3, 'INSTALLED', now(), now())
     ON CONFLICT (terminal_id) DO UPDATE SET ea_version = EXCLUDED.ea_version, status = 'INSTALLED', last_update_at = now()`,
    [terminalId, providerId, version]
  );
}

async function runDeploymentAction(action, { terminalId, machineId, dataPath = null, actor = "system.admin" }) {
  if (!isDatabaseConfigured()) throw new Error("database_not_configured");
  const terminal = await getTerminalContext(terminalId);
  const resolvedMachineId = machineId || terminal.machine_id;
  if (!resolvedMachineId) throw new Error("machine_not_linked");

  const versionRow = await getActiveVersion();
  const manifest = loadManifestFromDisk();
  const folder = await resolveTerminalFolder(terminalId, resolvedMachineId, { dataPath });
  const deployment = await createDeploymentRecord({
    terminalId,
    machineId: resolvedMachineId,
    versionRow,
    status: "DEPLOYING"
  });

  await appendDeploymentLog(deployment.id, `${action} started`, { details: { dataPath: folder.dataPath, version: versionRow.version } });

  const backupRoot = join(folder.dataPath, ".cacsms-backup", deployment.id);
  mkdirSync(backupRoot, { recursive: true });

  let result = runPythonDeployAction(action, folder.dataPath, deployment.id);
  if (!result || result.ok === undefined) {
    result = executeLocalFileDeployment({ dataPath: folder.dataPath, backupRoot, manifest, action });
  }

  await persistDeploymentFiles(deployment.id, result.deployedFiles || []);

  if (!result.ok) {
    const failed = await finalizeDeployment(deployment.id, {
      status: "FAILED",
      navigatorVerified: Boolean(result.navigatorVerified),
      checksumVerified: false,
      rollbackSnapshot: result.snapshots || [],
      errorMessage: (result.errors || []).join("; ") || "deployment_failed"
    });
    await appendDeploymentLog(deployment.id, `${action} failed`, { level: "error", details: { errors: result.errors } });
    await appendLog({
      providerId: terminal.provider_id,
      providerName: terminal.terminal_name,
      event: "ea_deploy_failed",
      action: "EA Deploy Failed",
      actor,
      severity: "error",
      message: failed.error_message || "EA deployment failed"
    });
    return { deployment: failed, files: result.deployedFiles || [], logs: await listEaDeploymentLogs(deployment.id) };
  }

  const nextStatus = action === "verify" || result.navigatorVerified ? "VERIFIED" : "DEPLOYED";
  const completed = await finalizeDeployment(deployment.id, {
    status: nextStatus,
    navigatorVerified: Boolean(result.navigatorVerified),
    checksumVerified: true,
    rollbackSnapshot: result.snapshots || [],
    errorMessage: null
  });

  if (action === "deploy" || action === "update") {
    await markEaInstalled(terminalId, terminal.provider_id, versionRow.version);
    await query(`UPDATE infrastructure.machines SET mt5_count = GREATEST(mt5_count, 1), last_seen_at = now(), status = 'online' WHERE id = $1`, [resolvedMachineId]);
  }

  await appendDeploymentLog(deployment.id, `${action} completed`, {
    details: { status: nextStatus, navigatorVerified: result.navigatorVerified, refresh: result.refresh }
  });
  await appendLog({
    providerId: terminal.provider_id,
    providerName: terminal.terminal_name,
    event: `ea_${action}_completed`,
    action: `EA ${action} completed`,
    actor,
    severity: "info",
    message: `EA ${versionRow.version} ${action} ${nextStatus} for ${terminal.terminal_name}`
  });

  return { deployment: completed, folder, files: result.deployedFiles || [], navigatorVerified: result.navigatorVerified, refresh: result.refresh };
}

export async function deployEa(input) {
  return runDeploymentAction("deploy", input);
}

export async function updateEa(input) {
  return runDeploymentAction("update", input);
}

export async function verifyEa(input) {
  return runDeploymentAction("verify", input);
}

export async function rollbackEa(input) {
  const terminal = await getTerminalContext(input.terminalId);
  const { rows } = await query(
    `SELECT * FROM infrastructure.ea_deployments WHERE terminal_id = $1 AND rollback_snapshot IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [input.terminalId]
  );
  if (!rows[0]) throw new Error("rollback_snapshot_not_found");
  const snapshots = rows[0].rollback_snapshot || [];
  const manifest = loadManifestFromDisk();
  const folder = await resolveTerminalFolder(input.terminalId, input.machineId || terminal.machine_id, { dataPath: input.dataPath });
  const deployment = await createDeploymentRecord({
    terminalId: input.terminalId,
    machineId: input.machineId || terminal.machine_id,
    versionRow: await getActiveVersion(),
    status: "DEPLOYING"
  });
  const result = executeLocalFileDeployment({
    dataPath: folder.dataPath,
    backupRoot: join(folder.dataPath, ".cacsms-backup", deployment.id),
    manifest,
    action: "rollback",
    rollbackSnapshots: snapshots
  });
  await appendDeploymentLog(deployment.id, "rollback completed", { level: "warning" });
  const completed = await finalizeDeployment(deployment.id, {
    status: "DEPLOYED",
    navigatorVerified: result.navigatorVerified,
    checksumVerified: false,
    rollbackSnapshot: snapshots,
    errorMessage: null
  });
  return { deployment: completed, folder };
}

export async function syncDiscoveredTerminalPaths({ machineId, terminalId } = {}) {
  if (terminalId && machineId) {
    const discovered = discoverWindowsMt5DataFolders();
    const folder = discovered.find((item) => item.terminalInstallId)
      || discovered[0];
    if (folder) await upsertTerminalPaths(terminalId, machineId, folder);
    return { discovered, synced: Boolean(folder), linked: folder ? [{ terminalId, terminalInstallId: folder.terminalInstallId, dataPath: folder.dataPath }] : [] };
  }
  return ensureTerminalPathLinks();
}

function mapDeployment(row) {
  return {
    id: row.id,
    machineId: row.machine_id,
    terminalId: row.terminal_id,
    terminalName: row.terminal_name,
    machineName: row.machine_name,
    status: row.status,
    eaVersion: row.ea_version,
    navigatorVerified: row.navigator_verified,
    checksumVerified: row.checksum_verified,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at
  };
}

export async function listEaDeployments({ terminalId = null, machineId = null, limit = 50 } = {}) {
  if (!isDatabaseConfigured()) return [];
  const params = [];
  const filters = [];
  if (terminalId) {
    params.push(terminalId);
    filters.push(`d.terminal_id = $${params.length}`);
  }
  if (machineId) {
    params.push(machineId);
    filters.push(`d.machine_id = $${params.length}`);
  }
  params.push(limit);
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT d.*, t.terminal_name, m.name AS machine_name
     FROM infrastructure.ea_deployments d
     LEFT JOIN infrastructure.mt5_terminals t ON t.id = d.terminal_id
     LEFT JOIN infrastructure.machines m ON m.id = d.machine_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(mapDeployment);
}

export async function listEaDeploymentLogs(deploymentId = null, { limit = 100 } = {}) {
  if (!isDatabaseConfigured()) return [];
  if (deploymentId) {
    const { rows } = await query(
      `SELECT * FROM infrastructure.ea_deployment_logs WHERE deployment_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [deploymentId, limit]
    );
    return rows.map((row) => ({
      id: row.id,
      deploymentId: row.deployment_id,
      level: row.level,
      message: row.message,
      details: row.details,
      createdAt: row.created_at
    }));
  }
  const { rows } = await query(
    `SELECT l.*, d.terminal_id, t.terminal_name
     FROM infrastructure.ea_deployment_logs l
     LEFT JOIN infrastructure.ea_deployments d ON d.id = l.deployment_id
     LEFT JOIN infrastructure.mt5_terminals t ON t.id = d.terminal_id
     ORDER BY l.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    deploymentId: row.deployment_id,
    terminalName: row.terminal_name,
    level: row.level,
    message: row.message,
    details: row.details,
    createdAt: row.created_at
  }));
}

export async function getEaDeploymentDashboard() {
  await ensureTerminalPathLinks();
  const [deployments, logs, versions, machines, terminals, discovered] = await Promise.all([
    listEaDeployments(),
    listEaDeploymentLogs(null, { limit: 50 }),
    isDatabaseConfigured() ? query(`SELECT version, active, created_at FROM infrastructure.ea_versions ORDER BY created_at DESC`).then((r) => r.rows) : [],
    isDatabaseConfigured() ? query(`SELECT id, name, status FROM infrastructure.machines ORDER BY name`).then((r) => r.rows.map((row) => ({ id: row.id, name: row.name, status: row.status }))) : [],
    isDatabaseConfigured()
      ? query(`SELECT t.id, t.terminal_name, t.machine_id, t.ea_version, t.ea_status, p.data_path, p.terminal_install_id
               FROM infrastructure.mt5_terminals t
               LEFT JOIN infrastructure.mt5_terminal_paths p ON p.terminal_id = t.id
               ORDER BY t.created_at DESC`).then((r) => r.rows.map((row) => ({
          id: row.id,
          terminalName: row.terminal_name,
          machineId: row.machine_id,
          eaVersion: row.ea_version,
          eaStatus: row.ea_status,
          dataPath: row.data_path,
          terminalInstallId: resolveTerminalInstallId(row.data_path, row.terminal_install_id)
        })))
      : [],
    Promise.resolve(discoverMt5TerminalPaths())
  ]);
  const activeVersion = versions.find((row) => row.active)?.version || loadManifestFromDisk().version;
  return { deployments, logs, versions, machines, terminals, discovered, activeVersion };
}
