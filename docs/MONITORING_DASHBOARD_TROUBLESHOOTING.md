# Monitoring Dashboard Troubleshooting Guide

## API Response Format Standards
- All monitoring endpoints should return a consistent wrapper:
  - Success: `{ success: true, data: ... }`
  - Failure: `{ success: false, message?: string, error?: string }`
- This format is expected by `dashboard.html` for:
  - `/admin/monitoring/metrics`
  - `/admin/monitoring/db/stats`
  - `/admin/monitoring/network/stats`
  - `/admin/monitoring/errors`
  - `/admin/monitoring/env`

### Examples
- Metrics (via `MonitoringController.getMetrics`):
  - `200 OK { "success": true, "data": { "server": {...}, "system": {...} } }`
- DB Stats:
  - `200 OK { "success": true, "data": { ... } }`
- Network Stats:
  - `200 OK { "success": true, "data": { ... } }`
- Errors:
  - `200 OK { "success": true, "data": [ ... ], "pagination": { ... } }`
- Env:
  - `200 OK { "success": true, "data": { "variables": [...], "filename": "...", "path": "..." } }`

## Common Issues

### Dashboard shows no data (Uptime: `--`, Memory: `--%`, empty charts)
- **Cause**: Metrics endpoint returns a raw object instead of `{ success, data }`.
- **Fix**:
  - Ensure `MonitoringController.getMetrics()` returns `{ success: true, data: metrics }`.
  - Use browser DevTools Network tab to confirm the response shape.

### "Failed to fetch env vars: .env file not found"
- **Cause**: Old env implementation using a hardcoded `.env` path.
- **Fix**:
  - Routes must be wired to `EnvEditorController` via `monitoring.routes.js`.
  - `EnvEditorService` will auto-detect the correct file (`.env.${NODE_ENV}`, `.env.local`, `.env`).

### "TypeError: Cannot read properties of undefined (reading 'length')" in errors tab
- **Cause**: `renderErrors()` accesses `errors.length` when `errors` is `undefined` or `null`.
- **Fix**:
  - Ensure `renderErrors` guards with `if (!errors || !Array.isArray(errors) || errors.length === 0) { ... }`.

### WebSocket logs not appearing
- **Possible causes**:
  - WebSocket auth failing.
  - History payload shape not matching expectation.
- **Checks**:
  - Verify `/admin/monitoring/logs/stream` upgrades successfully (status 101).
  - Confirm history frames use `{ type: 'history', data: recentLogs }` or `{ type: 'history', logs: [...] }`.
  - Ensure `connectWebSocket()` and `handleLogPayload()` handle both `logs` and `data` arrays for history.

## Environment File Detection

Order of precedence (handled by `EnvEditorService`):
1. `.env.${NODE_ENV}` (e.g. `.env.development`, `.env.production`)
2. `.env.local`
3. `.env`

Notes:
- The project commonly uses `.env.local` for staging/development overrides.
- When the service starts, it logs which file it is editing:
  - e.g. `📝 Env Editor: Editing file ".env.local" (NODE_ENV=development)`
- The env editor routes in `monitoring.routes.js` should call:
  - `envEditorController.getEnv(request, reply)`
  - `envEditorController.updateEnv(request, reply)`

## Testing Checklist

### API Level
- Use `curl` or Postman:
  - `GET /admin/monitoring/metrics`
  - `GET /admin/monitoring/db/stats`
  - `GET /admin/monitoring/network/stats`
  - `GET /admin/monitoring/errors`
  - `GET /admin/monitoring/env`
- Confirm:
  - HTTP status is `200 OK`.
  - Response body matches `{ success: true, data: ... }`.

### Browser Level
- Open `/admin/monitoring/dashboard` with DevTools open.
- Confirm:
  - No uncaught exceptions in the Console.
  - Uptime and memory stats display numeric values.
  - Charts render and update over time.
  - Errors tab shows either a list or "No errors found".
  - Env tab loads variables without ".env file not found" errors.

## Adding New Monitoring Endpoints

When adding new controllers/routes for the dashboard:
- Controller methods should:
  - `try`/`catch` errors.
  - On success: `return { success: true, data };`
  - On failure: `reply.status(500).send({ success: false, error: error.message });`
- Routes in `monitoring.routes.js` should delegate to the controller instance and preserve auth hooks.
- Frontend code in `dashboard.html` should:
  - Use `fetch(...)`.
  - Check `json.success` before using `json.data`.
  - Log unexpected structures to the console for easier debugging.

## Debugging Tips

- **Enable verbose logs**:
  - Add temporary `console.log` statements around fetch responses in `fetchData()` when chasing format issues.
- **Inspect network traffic**:
  - Use the browser Network tab to verify the shape and status of each monitoring endpoint.
- **Check server logs**:
  - Look for stack traces or structured error logs from `MonitoringController` and related services.
- **Verify auth**:
  - Ensure monitoring cookies or headers are present for protected routes.

