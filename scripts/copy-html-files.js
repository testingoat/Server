import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src/features/monitoring');
const DIST_DIR = path.join(__dirname, '../dist/features/monitoring');

function copyHtmlFiles(srcDir, distDir) {
    // Check if source directory exists
    if (!fs.existsSync(srcDir)) {
        console.warn(`⚠️  Warning: Source directory not found: ${srcDir}`);
        return;
    }

    // Create destination if needed
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // Read entries
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const distPath = path.join(distDir, entry.name);

        if (entry.isDirectory()) {
            // Skip node_modules, .git, dist
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
                continue;
            }
            copyHtmlFiles(srcPath, distPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            fs.copyFileSync(srcPath, distPath);
            console.log(`📄 Copied: ${entry.name}`);
        }
    }
}

console.log('📦 Copying .html files from monitoring feature...');
copyHtmlFiles(SRC_DIR, DIST_DIR);
console.log('✅ All .html files copied successfully!');
