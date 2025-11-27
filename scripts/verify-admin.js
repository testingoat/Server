import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Admin } from '../src/models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env.local');
    process.exit(1);
}

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};

const verifyOrCreateAdmin = async () => {
    await connectDB();

    const args = process.argv.slice(2);
    const email = args[0];
    const password = args[1];
    const name = args[2] || 'Admin User';

    if (!email) {
        console.log('\n📋 Existing Admin Users:');
        console.log('----------------------------------------------------------------');
        console.log('| Email                          | Name           | Role  | Active |');
        console.log('----------------------------------------------------------------');

        const admins = await Admin.find({});

        if (admins.length === 0) {
            console.log('| No admin users found.                                        |');
        } else {
            admins.forEach(admin => {
                const emailPad = admin.email.padEnd(30).substring(0, 30);
                const namePad = (admin.name || 'N/A').padEnd(14).substring(0, 14);
                const rolePad = admin.role.padEnd(5);
                const activePad = (admin.isActivated ? 'Yes' : 'No ').padEnd(6);
                console.log(`| ${emailPad} | ${namePad} | ${rolePad} | ${activePad} |`);
            });
        }
        console.log('----------------------------------------------------------------');
        console.log('\nUsage:');
        console.log('  List admins:   node scripts/verify-admin.js');
        console.log('  Verify admin:  node scripts/verify-admin.js [email]');
        console.log('  Create admin:  node scripts/verify-admin.js [email] [password] [name]');
        process.exit(0);
    }

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
        console.log(`\n✅ Admin found: ${existingAdmin.email}`);
        console.log(`   Name: ${existingAdmin.name}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Activated: ${existingAdmin.isActivated}`);
        console.log(`   Password Set: ${!!existingAdmin.password}`);

        if (password) {
            if (existingAdmin.password === password) {
                console.log('   Password Match: ✅ YES');
            } else {
                console.log('   Password Match: ❌ NO');
            }
        }
    } else {
        if (!password) {
            console.log(`\n❌ Admin not found: ${email}`);
            console.log('   To create this admin, provide a password:');
            console.log(`   node scripts/verify-admin.js ${email} [password] [name]`);
        } else {
            console.log(`\n🆕 Creating new admin: ${email}`);
            try {
                const newAdmin = new Admin({
                    email,
                    password, // Plain text as per current schema
                    name,
                    role: 'Admin',
                    isActivated: true
                });

                await newAdmin.save();
                console.log('✅ Admin created successfully!');
                console.log(`   Email: ${email}`);
                console.log(`   Password: ${password}`);
                console.log('   ⚠️  Warning: Password stored in plain text (dev/staging only)');
            } catch (error) {
                console.error('❌ Error creating admin:', error.message);
            }
        }
    }

    await mongoose.connection.close();
    process.exit(0);
};

verifyOrCreateAdmin();
