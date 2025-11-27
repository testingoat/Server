# Backend FAST2SMS OTP Implementation

## Overview
This document describes the backend implementation of the FAST2SMS OTP (One-Time Password) functionality. The implementation includes OTP generation, storage, verification, rate limiting, and SMS sending via the FAST2SMS service.

## Architecture

### Components

1. **Models** (`src/models/otp.js`)
   - `OTPAttempt`: Tracks OTP request attempts for rate limiting
   - `OTPToken`: Stores hashed OTPs with expiration

2. **Services** (`src/services/`)
   - `fast2sms.js`: Interface with FAST2SMS API
   - `otp.js`: OTP generation, hashing, verification, and rate limiting

3. **Controllers** (`src/controllers/auth/otp.js`)
   - `requestOTP`: Handle OTP request endpoint
   - `verifyOTP`: Handle OTP verification endpoint
   - `testOTP`: Test endpoint for development

4. **Routes** (`src/routes/auth.js`)
   - `/auth/otp/request`: POST endpoint for requesting OTP
   - `/auth/otp/verify`: POST endpoint for verifying OTP
   - `/auth/otp/test`: POST test endpoint (development only)

## Implementation Details

### OTP Generation and Storage
1. Generate random numeric OTP (default 6 digits)
2. Hash OTP using bcrypt before storage
3. Store hashed OTP with expiration time (default 5 minutes)
4. Record OTP request attempt for rate limiting

### Rate Limiting and Backoff
1. Track OTP requests per phone+IP combination
2. Limit to 3 requests per 5-minute window by default
3. Implement exponential backoff after limit exceeded:
   - Base delay: 1 second
   - Multiplier: 2x for each subsequent violation
   - Maximum delay: 5 minutes

### FAST2SMS Integration
1. Support both DLT-compliant and standard OTP routes
2. Automatic selection based on environment configuration
3. Error handling for network and API issues
4. Request ID tracking for audit purposes

### Security Measures
1. OTPs stored as bcrypt hashes, never in plain text
2. Rate limiting prevents abuse
3. Exponential backoff for repeated violations
4. No OTP values logged or returned in responses
5. IP address hashing for privacy

## API Endpoints

### POST /auth/otp/request
**Request Body:**
```json
{
  "phone": "9999999999"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "requestId": "otp_token_id"
}
```

### POST /auth/otp/verify
**Request Body:**
```json
{
  "phone": "9999999999",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

## Environment Configuration

### Required Variables
```env
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FTWSMS
DLT_ENTITY_ID=your_dlt_entity_id
DLT_TEMPLATE_ID=your_dlt_template_id
```

### Optional Variables
```env
OTP_RATE_LIMITS={"window": 300, "maxRequests": 3}
OTP_TTL=300
OTP_LENGTH=6
OTP_BACKOFF_POLICY={"baseDelay": 1000, "maxDelay": 300000, "multiplier": 2}
```

## Database Schema

### OTP Attempts
```javascript
{
  phone: String,        // Phone number (indexed)
  ipHash: String,       // Hashed IP address
  attemptCount: Number, // Number of attempts
  lastAttemptAt: Date,  // Last attempt timestamp
  blockedUntil: Date,   // Block expiration (backoff)
  windowStart: Date     // Rate limit window start
}
```

### OTP Tokens
```javascript
{
  phone: String,        // Phone number (indexed)
  otpHash: String,      // Bcrypt hashed OTP
  createdAt: Date,      // Creation timestamp
  expiresAt: Date,      // Expiration timestamp (indexed)
  requestId: String,    // Provider reference
  consumedAt: Date      // Consumption timestamp
}
```

## Security Considerations

1. **OTP Storage**: All OTPs stored as bcrypt hashes with configurable cost factor
2. **Rate Limiting**: Prevents brute force attacks with sliding window
3. **Backoff Algorithm**: Exponential delay for repeated violations
4. **IP Privacy**: IP addresses stored as SHA-256 hashes
5. **No Logging**: OTP values never logged or included in responses
6. **Expiration**: OTPs automatically expire after configurable TTL
7. **Single Use**: OTPs marked as consumed after first successful verification

## Error Handling

### Client Errors (4xx)
- 400 Bad Request: Missing or invalid parameters
- 429 Too Many Requests: Rate limit or backoff enforced

### Server Errors (5xx)
- 500 Internal Server Error: Unexpected errors during processing
- 502 Bad Gateway: FAST2SMS API errors

## Testing

### Development Endpoints
- `/auth/otp/test`: Test endpoint available only in non-production environments

### Test Scenarios
1. Valid OTP request and verification
2. Invalid OTP verification
3. Expired OTP verification
4. Rate limit enforcement
5. Backoff algorithm
6. FAST2SMS API failures
7. Database connectivity issues

## Performance Considerations

### Indexing
- Phone numbers indexed in both collections
- Expiration timestamps indexed for cleanup
- Creation timestamps indexed for TTL operations

### Cleanup
- Expired OTP tokens automatically removed
- Old attempt records cleaned based on window configuration

### Caching
- No caching implemented to ensure consistency
- Database queries optimized with proper indexing

## Monitoring and Observability

### Logging
- All OTP operations logged (without sensitive data)
- FAST2SMS API calls logged
- Error conditions logged with context

### Metrics
- OTP request count
- OTP verification success/failure rates
- Rate limit violations
- FAST2SMS API response times
- Backoff events

## Rollback Plan

### Disable OTP Sending
1. Set feature flag to disable SMS sending
2. Revert to dry-run mode for testing
3. Clear active OTP tokens if needed

### Database Cleanup
1. Drop OTP collections if rollback required
2. Reset rate limit counters
3. Clear backoff blocks

### Configuration Reset
1. Revert environment variables to previous values
2. Restore previous authentication method if needed