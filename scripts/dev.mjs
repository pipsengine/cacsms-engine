import { spawn } from "node:child_process";
import { createServer } from "node:net";

const services = [
  { name: "WEB", port: Number(process.env.PORT || 4173), entry: "apps/web/server.mjs" },
  { name: "API", port: Number(process.env.API_PORT || 8080), entry: "apps/api/src/server.mjs" }
];
const children = [];
let shuttingDown = false;

function checkPort(port) {
  return new Promise((resolve) => {
    const tester = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

function stop(exitCode = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(exitCode);
}

for (const service of services) {
  if (!await checkPort(service.port)) {
    console.error(`[CACSMS] Cannot start ${service.name}: port ${service.port} is already in use.`);
    console.error("[CACSMS] Run `npm run stop` and try again.");
    stop(1);
  }
}

console.log("[CACSMS] Starting foundation system...");
for (const service of services) {
  const child = spawn(process.execPath, [service.entry], { stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[${service.name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${service.name}] ${chunk}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[CACSMS] ${service.name} stopped unexpectedly (${signal || code}).`);
      stop(code || 1);
    }
  });
}

console.log("[CACSMS] Web console: http://localhost:4173");
console.log("[CACSMS] Workflow:    http://localhost:4173/workflow/end-to-end");
console.log("[CACSMS] API health:  http://localhost:8080/api/system/health");
console.log("[CACSMS] Press Ctrl+C to stop both services.");

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
