# Monitoring Dashboard Authentication

The monitoring dashboard at `/admin/monitoring/dashboard` uses a custom JWT-based authentication system, separate from but sharing the same user database as the AdminJS panel.

## Authentication Flow

1. **Login Page**: User visits `/admin/monitoring/auth/login` and enters credentials.
2. **Verification**: Credentials are checked against the `Admin` collection in MongoDB.
3. **Token Generation**: On success, a JWT is generated containing the user's ID, email, and role.
4. **Cookie**: The JWT is stored in an HTTP-only cookie named `monitoring_token`.
5. **Access**: Subsequent requests to `/admin/monitoring/*` are intercepted by `verifyMonitoringAuth` middleware which validates the token.

## Default Credentials

The system comes with a default admin user (in staging/dev environments):

- **Email:** `prabhudevarlimatti@gmail.com`
- **Password:** `12345678`
- **Role:** `Admin`

> [!WARNING]
> **Security Risk:** Change these credentials immediately in a production environment.

## Managing Admin Users

We provide a utility script to manage admin users easily.

### List All Admins
```bash
npm run admin:verify
```

### Verify Specific Admin
Check if an admin exists and verify their password:
```bash
npm run admin:verify -- your-email@example.com
```

### Create New Admin
Create a new admin user with specific credentials:
```bash
npm run admin:verify -- new-admin@example.com securePassword123 "Admin Name"
```

## Troubleshooting

### "Invalid credentials" Error
- Ensure the user exists in the `Admin` collection (not Customer or Seller).
- Passwords are currently case-sensitive.
- Verify the user has `isActivated: true`.

### "Unauthorized access" Error
- The user must have the role `Admin` or `Super Admin`. Other roles are denied access to the dashboard.

### Login Loop (Redirects back to login)
- **Cookie Issues**: Ensure your browser accepts cookies.
- **Token Expiry**: The session lasts for 24 hours.
- **Environment**: In production (`NODE_ENV=production`), cookies are set with `Secure` flag, requiring HTTPS. If accessing via HTTP in production mode, login will fail.

## Related Files

- `src/features/monitoring/auth/auth.controller.js`: Handles login/logout logic.
- `src/features/monitoring/auth/auth.middleware.js`: Protects routes and verifies JWT.
- `src/config/config.js`: Contains the core `authenticate()` helper function.
- `scripts/verify-admin.js`: CLI tool for admin management.
