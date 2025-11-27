# Server

## Monitoring Dashboard Authentication

The monitoring dashboard at `/admin/monitoring/dashboard` requires admin authentication.

### Default Credentials
- **Email:** `prabhudevarlimatti@gmail.com`
- **Password:** `12345678`
- ⚠️ **Change these credentials in production!**

### Managing Admin Users

**List all admins:**
```bash
npm run admin:verify
```

**Create new admin:**
```bash
npm run admin:verify -- your-email@example.com your-password "Your Name"
```

**Verify specific admin:**
```bash
npm run admin:verify -- your-email@example.com
```

For detailed documentation, see `docs/MONITORING_AUTH.md`.
