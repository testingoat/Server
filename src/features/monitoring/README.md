# 🚀 GoatGoat Server Monitoring Dashboard

A comprehensive real-time monitoring dashboard for the GoatGoat server application built with Fastify, WebSocket, and Chart.js.

## ✨ Features

- **Real-time Metrics**: Live server performance data updated every 30 seconds
- **Interactive Charts**: Memory and CPU usage visualization with Chart.js
- **Log Streaming**: Real-time log viewing with WebSocket connection
- **Backup Management**: Create, download, and manage server backups
- **Server Control**: Restart server functionality (PM2 compatible)
- **Responsive Design**: Glass-morphism UI that works on all devices

## 🛠️ Setup Instructions

### Prerequisites

Ensure the following dependencies are installed in your server:

```bash
npm install @fastify/websocket ws archiver chart.js
```

### Route Registration

The monitoring routes are automatically registered in `app.ts`:

```typescript
// Register monitoring routes from feature-based architecture
try {
    const { monitoringRoutes } = await import('./features/monitoring/monitoring.routes.js');
    const { monitoringService } = await import('./features/monitoring/monitoring.service.js');

    await app.register(monitoringRoutes);

    // Initialize service (starts collector and log interceptor)
    await monitoringService.initialize(app.server);

    console.log('✅ Monitoring routes registered successfully (FBA)');
} catch (error) {
    console.error('⚠️ Error registering monitoring routes:', error);
    // Don't exit - continue without monitoring routes
}
```

### Dashboard Route

The monitoring dashboard is served at:
```
/admin/monitoring-dashboard
```

## 📊 API Endpoints

### Metrics
- `GET /admin/monitoring/metrics` - Get current server metrics
- `GET /admin/monitoring/historical?range={range}` - Get historical data
  - Range options: `1h`, `6h`, `24h`, `7d`

### Logs
- `GET /admin/monitoring/logs/recent` - Get recent log entries
- `WS /admin/monitoring/logs/stream` - WebSocket for real-time log streaming

### Backups
- `GET /admin/monitoring/backups` - List all backups
- `POST /admin/monitoring/backup` - Create new backup
- `GET /admin/monitoring/download/{filename}` - Download backup file

### Server Control
- `POST /admin/monitoring/restart` - Restart server (PM2 only)

## 🎯 Usage Guide

### Viewing Metrics

1. **Quick Stats**: Shows uptime and memory usage percentage
2. **Detailed Metrics**: Server health, memory details, and system information
3. **Charts**: Real-time memory and CPU usage visualization
4. **Auto-refresh**: Data updates every 30 seconds automatically

### Log Management

1. **Real-time Streaming**: Logs appear automatically via WebSocket
2. **Filtering**: Filter by log level (ALL, INFO, WARN, ERROR)
3. **Search**: Search log messages for specific text
4. **Auto-scroll**: Toggle automatic scrolling to latest logs

### Backup Operations

1. **Create Backup**: Click "Create Backup" to generate server backup
2. **Download**: Click download links to get backup files
3. **Auto-cleanup**: Automatically keeps only the 7 most recent backups

### Server Control

1. **Restart**: Use restart button to gracefully restart the server
2. **PM2 Required**: Restart functionality only works with PM2 process manager

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Disable Firebase initialization
DISABLE_FIREBASE=true

# Required for restart functionality
PM2_HOME=/path/to/pm2/home
```

### Backup Configuration

Backups are stored in the `backups/` directory and exclude:
- `node_modules/`
- `.git/`
- `backups/`
- `dist/`
- `coverage/`
- `.gemini/`

### Log Buffer

- Maximum log entries: 500
- Auto-rotation: Oldest entries removed when buffer is full
- Console interception: All console output is captured

## 🧪 Testing

Run the test script to verify functionality:

```bash
node test-monitoring.js
```

This will test:
- Dashboard HTML loading
- API endpoint responses
- WebSocket connectivity
- Backup functionality

## 🐛 Troubleshooting

### WebSocket Issues

**Symptoms**: "Disconnected" status, no real-time logs

**Solutions**:
1. Verify `@fastify/websocket` is properly registered
2. Check firewall settings allow WebSocket connections
3. Ensure no conflicting WebSocket routes
4. Check browser console for specific error messages

### Chart Loading Issues

**Symptoms**: Charts don't display data

**Solutions**:
1. Check Chart.js library loads (Network tab)
2. Verify API endpoints return valid data
3. Check browser console for JavaScript errors
4. Ensure historical data exists in database

### Backup Problems

**Symptoms**: Backup creation fails

**Solutions**:
1. Ensure `backups/` directory exists and is writable
2. Verify `archiver` package is installed
3. Check server logs for backup creation errors
4. Ensure sufficient disk space

### Performance Issues

**Symptoms**: Dashboard is slow or unresponsive

**Solutions**:
1. Reduce metrics collection interval
2. Limit log buffer size
3. Optimize database queries for historical data
4. Check server resource usage

## 📝 Development Notes

### Architecture

The monitoring system follows a feature-based architecture:

```
src/features/monitoring/
├── dashboard.html          # Frontend dashboard
├── monitoring.routes.js    # Fastify route definitions
├── monitoring.controller.js # Request handlers
├── monitoring.service.js   # Business logic
├── monitoring.model.js    # MongoDB schema
└── README.md            # This documentation
```

### Data Flow

1. **Collection**: Service collects metrics every 30 seconds
2. **Storage**: Metrics stored in MongoDB with 7-day TTL
3. **Broadcast**: Logs broadcast via WebSocket to connected clients
4. **Display**: Frontend renders real-time data in charts and UI

### Security Considerations

- Backup downloads validate filenames to prevent directory traversal
- WebSocket connections are automatically cleaned up on disconnect
- All routes inherit existing authentication middleware
- Sensitive system information is filtered from public display

## 🔄 Updates and Maintenance

### Regular Tasks

- Monitor log buffer size and adjust if needed
- Check backup directory size and cleanup settings
- Review metrics collection performance impact
- Update Chart.js library for security patches

### Database Maintenance

- Historical metrics automatically expire after 7 days
- Consider adjusting TTL based on storage needs
- Monitor database size and indexing performance

## 📞 Support

For issues with the monitoring dashboard:

1. Check browser console for JavaScript errors
2. Review server logs for backend errors
3. Run the test script to identify specific issues
4. Verify all prerequisites are properly installed

## 🎨 UI Customization

The dashboard uses CSS custom properties for theming:

```css
:root {
    --bg-color: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.7);
    --accent-color: #8b5cf6;
    /* ... more variables */
}
```

Modify these in `dashboard.html` to customize the appearance.
