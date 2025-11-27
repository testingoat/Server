import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_PUBLIC = path.join(__dirname, '../src/public');
const DIST_PUBLIC = path.join(__dirname, '../dist/public');

// Recursively copy directory
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    entries.forEach(entry => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

if (fs.existsSync(SRC_PUBLIC)) {
    console.log('📦 Copying public folder to dist...');
    copyDirectory(SRC_PUBLIC, DIST_PUBLIC);
    console.log('✅ Public folder copied successfully!');
} else {
    console.log('⚠️  No public folder found in src, skipping...');
}
