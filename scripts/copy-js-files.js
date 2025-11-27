import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');

// Recursively copy .js files from src to dist
function copyJsFiles(srcDir, distDir) {
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    entries.forEach(entry => {
        const srcPath = path.join(srcDir, entry.name);
        const distPath = path.join(distDir, entry.name);

        if (entry.isDirectory()) {
            // Skip certain directories
            if (!['node_modules', '.git', 'dist', 'public'].includes(entry.name)) {
                copyJsFiles(srcPath, distPath);
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            // Copy .js file
            fs.copyFileSync(srcPath, distPath);
            console.log(`✅ Copied: ${path.relative(SRC_DIR, srcPath)}`);
        }
    });
}

console.log('📦 Copying .js files from src to dist...');
copyJsFiles(SRC_DIR, DIST_DIR);
console.log('✅ All .js files copied successfully!');
