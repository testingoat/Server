# Monitoring Dashboard Structure

## Overview
- Purpose: Real-time visibility into GoatGoat server health (CPU, memory, logs, backups, env vars, errors, database stats).
- Stack: Vanilla HTML/CSS, Chart.js, Fetch API, WebSocket streaming, Fastify monitoring routes.
- Primary file: `src/features/monitoring/dashboard.html` (~1,100 lines combining markup, styles, and scripts).
- Load order: HTML layout → inline styles → inline script containing helpers, data fetching, rendering, and initialization logic.

## File Structure
1. **Head (lines 1-386)** – Metadata, fonts, Chart.js CDN, and global styles for glassmorphism cards, badges, grids, tabs, log panels, and buttons.
2. **Body Content (lines 387-743)** – Header, quick actions, backup table, real-time logs, tab navigation, and content panes for dashboard, database, network, query, errors, and settings.
3. **Script Block (lines 744-1106)** – Global state, helper utilities, chart initialization, fetch/update routines, log streaming/WebSocket logic, MongoDB query helpers, error management, environment editor, and DOMContentLoaded bootstrapper.

## Required Functions
All functions below must exist exactly once; they form the public surface for the Admin dashboard:
- `addDataToChart(chart, label, data)` – Pushes data into a Chart.js instance while enforcing the rolling window limit.
- `addEnvVar()` – Reads the “new key/value” inputs, pushes into `envVars`, and re-renders the table.
- `clearResolvedErrors()` – Confirms and clears resolved errors via `/admin/monitoring/errors/clear`, then refreshes.
- `connectWebSocket()` – Opens `/admin/monitoring/logs/stream` with exponential backoff, parses history + incremental payloads, updates connection badge, and feeds `renderLogs()`.
- `downloadBackup(filename)` – Creates a temporary anchor to `/admin/monitoring/download/:filename` and triggers the download.
- `fetchBackups()` – Pulls `/admin/monitoring/backups`, handles empty/error states, and renders the backup table.
- `fetchCollections()` – Lazy-loads MongoDB collection names for the query tool.
- `fetchData()` – Sequentially loads `/metrics`, `/db/stats`, `/network/stats`, then calls the respective renderers.
- `fetchEnvVars()` – Retrieves `/env`, parses `.env` pairs, and populates `envVars` before `renderEnvVars()`.
- `fetchErrors(page = 1)` – Requests `/errors?page=&limit=`, honors status filter, caches pagination, and delegates to `renderErrors()`.
- `formatBytes(bytes, decimals)` – Converts raw byte counts to a human-readable string.
- `formatUptime(seconds)` – Converts uptime seconds to `Xd Xh Xm Xs`.
- `getCookie(name)` – Simplistic cookie lookup for authenticated requests.
- `initCharts()` – Creates the Memory and CPU `Chart` instances using shared options; can be extended for DB/network charts.
- `removeEnvVar(index)` – Splices `envVars` and re-renders the table.
- `renderEnvVars()` – Populates the settings table, honors mask/unmask, wires remove buttons, and keeps edits synced.
- `renderErrors(errors)` – Prints error rows with time, level badge, message snippet, status badge, and Resolve/View actions.
- `renderLogs()` – Applies level/search filters, caps to 100 entries, colorizes badges, and auto-scrolls when enabled.
- `runQuery()` – Executes ad-hoc MongoDB queries through `/db/query` and prints formatted results.
- `saveEnvVars()` – Serializes `envVars` back to `.env` format and posts to `/env`.
- `switchTab(tabId)` – Toggles tab visibility, active buttons, and lazily loads per-tab resources.
- `toggleMask()` – Flips `showValues` and refreshes the environment table (also adjusts button label).
- `updateDashboard(data)` – Defensive render of server metrics (uptime, CPU, memory stats, charts).
- `updateDbStats(data)` – Validates and renders DB size/objects/index cards plus storage chart.
- `updateErrorStatus(id, status)` – PATCH helper for status transitions.
- `updateNetworkStats(data)` – Validates and renders live network KPIs and charts.

## API Endpoints
- `GET /admin/monitoring/metrics` – Server CPU/memory/uptime.
- `GET /admin/monitoring/db/stats` – Collection sizes, counts, indexes.
- `GET /admin/monitoring/db/collections` – Collection name list for query tool.
- `POST /admin/monitoring/db/query` – Executes MongoDB `find/findOne/count/aggregate`.
- `GET /admin/monitoring/network/stats` – Active connections, RPS, latency, bandwidth.
- `GET /admin/monitoring/backups` – Available archive metadata.
- `POST /admin/monitoring/backup` – Triggers fresh backup creation.
- `GET /admin/monitoring/download/:filename` – Streams a selected backup file.
- `GET /admin/monitoring/errors` – Paginated error log feed with optional status filter.
- `PATCH /admin/monitoring/errors/:id` – Status transitions (new/investigating/resolved/ignored).
- `POST /admin/monitoring/errors/clear` – Bulk clearing of resolved entries.
- `GET /admin/monitoring/env` – Returns current `.env` content.
- `POST /admin/monitoring/env` – Persists updated environment variables.
- `WS /admin/monitoring/logs/stream` – Bi-directional log stream (history + live entries).

## Common Corruption Patterns
1. **Missing functions** – DOMContentLoaded invokes helpers (`connectWebSocket`, `fetchBackups`, etc.) that were deleted or renamed, causing `ReferenceError`.
2. **Duplicate definitions** – Manual merges create two copies of the same function; whichever appears last silently overrides the earlier logic.
3. **Nested tab markup** – Copy/paste accidents embed one tab’s HTML into another, breaking `switchTab`.
4. **Unbalanced braces/tags** – Inline `<script>` lacks closing braces or parentheses after manual edits, blocking JS execution.
5. **Markdown remnants** – Accidentally pasting ````` fences or `> quotes` into the script section leads to syntax errors.
6. **Orphan snippets** – Half-implemented sections (e.g., stray `fetch(` call) left outside a function cause runtime failures during parsing.

## Maintenance Guidelines
1. Always run `npm run validate:dashboard` before committing – it checks for missing/duplicate functions, brace balance, and markdown artifacts.
2. Keep function order logical: globals → helpers → data fetching → renderers → initialization.
3. Back up `dashboard.html` (`cp dashboard.html dashboard.html.backup-$(date +%Y%m%d)`) before large refactors.
4. Test every tab and quick action in a browser after edits (metrics, DB, network, query, errors, settings).
5. Watch DevTools console for WebSocket or fetch failures; the dashboard should degrade gracefully with logged warnings.
6. Note changes in this document whenever new API endpoints or helper functions are introduced.

## Troubleshooting
- **`connectWebSocket is not defined`** – Ensure the function exists above DOMContentLoaded; run the validator.
- **`Failed to fetch env vars`** – Backend route down or JSON shape changed; check server logs and the `fetchEnvVars` parser.
- **No logs rendering** – Confirm WS connected badge, verify `logs` array updates, and ensure `renderLogs` respects filters.
- **Charts not updating** – Chart.js CDN missing or IDs mismatched; re-run build and verify canvases exist.
- **Error table blank** – `/errors` route returning non-`success`; inspect network tab, then confirm `renderErrors` handles empty arrays.
- **Backup table empty** – Check `/backups` route permissions; `validate-dashboard` can warn about missing helper functions.
