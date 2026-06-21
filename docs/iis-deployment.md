# IIS Deployment

This frontend is configured for Windows Server + IIS with Next.js running as a local Windows service and IIS acting as the public reverse proxy.

## Production Shape

- IIS public site: `https://your-domain`
- Next.js frontend service: `http://127.0.0.1:3000`
- ASP.NET Core .NET 9 backend service: `http://127.0.0.1:5000`
- SignalR hubs: proxied through `/hubs/*`
- API routes: proxied through `/api/*`

The root `web.config` expects IIS URL Rewrite and Application Request Routing to be installed and proxy mode enabled.

## Build

```powershell
npm ci
npm run build
```

Next.js standalone output is emitted to:

```text
.next/standalone
```

## Run Frontend Service

For a quick server test:

```powershell
$env:PORT="3000"
$env:HOSTNAME="127.0.0.1"
node .next/standalone/server.js
```

For production, run the same command using a Windows service manager such as NSSM, WinSW, or your preferred service runner.

## IIS Routing

The included `web.config` routes:

- `/api/*` to ASP.NET Core on port `5000`
- `/hubs/*` to ASP.NET Core SignalR on port `5000`
- all other frontend routes to Next.js on port `3000`

Update ports in `web.config` if your backend or frontend services use different bindings.
