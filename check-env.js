// Environment variables checker for debugging
console.log('🔍 Environment Variables Check:');
console.log('================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGO_URI:', process.env.MONGO_URI ? '✅ Set' : '❌ Missing');
console.log('COOKIE_PASSWORD:', process.env.COOKIE_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET ? '✅ Set' : '❌ Missing');
console.log('REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET ? '✅ Set' : '❌ Missing');
console.log('================================');
console.log('Node.js Version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
