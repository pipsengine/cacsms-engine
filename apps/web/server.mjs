import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === "/"
    ? "index.html"
    : pathname === "/workflow/end-to-end"
      ? "workflow.html"
      : pathname === "/executive-command-center/workflow-dashboard"
        ? "executive-workflow-dashboard.html"
    : pathname === "/workspace/market-intelligence/logs" || pathname === "/market-intelligence/logs"
      ? "market-intelligence-logs.html"
    : pathname === "/workspace/market-intelligence/test-harness" || pathname === "/market-intelligence/test-harness"
      ? "market-intelligence-test-harness.html"
    : pathname.startsWith("/data/")
        ? `public${pathname}`
      : pathname.startsWith("/workspace/mt5-infrastructure/")
        ? "mt5-infrastructure.html"
      : pathname === "/workspace/universe-scanner" || pathname.startsWith("/workspace/universe-scanner/")
        ? "universe-scanner.html"
      : pathname === "/market-intelligence" || pathname.startsWith("/market-intelligence/") || pathname.startsWith("/workspace/market-intelligence/") || pathname.startsWith("/workspace/data-sources-validation/")
        ? "market-intelligence.html"
      : pathname.slice(1);
  const file = normalize(join(root, requested));

  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`CACSMS web console ready at http://localhost:${port}`);
});
