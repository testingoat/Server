import mongoose from 'mongoose';

// OTP Attempts Schema for rate limiting and backoff
const otpAttemptSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  ipHash: { type: String, required: true },
  // context separates request vs verify flows; older docs may not have this field
  context: { type: String, enum: ['request', 'verify'], default: 'verify', index: true },
  attemptCount: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: Date.now },
  blockedUntil: { type: Date },
  windowStart: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// OTP Tokens Schema for storing hashed OTPs
const otpTokenSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otpHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  requestId: { type: String }, // Provider reference
  consumedAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes for performance
otpAttemptSchema.index({ phone: 1, context: 1, lastAttemptAt: 1 });
otpTokenSchema.index({ phone: 1, expiresAt: 1 });
otpTokenSchema.index({ createdAt: 1 });

export const OTPAttempt = mongoose.model('OTPAttempt', otpAttemptSchema);
export const OTPToken = mongoose.model('OTPToken', otpTokenSchema);
