import { execFileSync } from "node:child_process";

const ports = [4173, 8080];
if (process.platform !== "win32") {
  console.log("[CACSMS] On non-Windows systems, stop the foreground dev process with Ctrl+C.");
  process.exit(0);
}

for (const port of ports) {
  const output = execFileSync("powershell.exe", [
    "-NoProfile", "-Command",
    `$connections = @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue); foreach ($connection in $connections) { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"; "$($process.ProcessId)|$($process.CommandLine)" }`
  ], { encoding: "utf8" }).trim();

  if (!output) {
    console.log(`[CACSMS] Port ${port} is already free.`);
    continue;
  }

  for (const row of output.split(/\r?\n/).filter(Boolean)) {
    const separator = row.indexOf("|");
    const pid = row.slice(0, separator);
    const commandLine = row.slice(separator + 1);
    const isCacsmsProcess = commandLine.includes("apps/web/server.mjs")
      || commandLine.includes("apps/api/src/server.mjs");

    if (!isCacsmsProcess) {
      console.error(`[CACSMS] Port ${port} belongs to another process (${pid}); it was not stopped.`);
      process.exitCode = 1;
      continue;
    }

    execFileSync("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force`]);
    console.log(`[CACSMS] Stopped CACSMS process ${pid} on port ${port}.`);
  }
}
