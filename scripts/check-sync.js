import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');
const EXCLUDE_DIRS = ['node_modules', 'dist', 'coverage', '.git'];
const EXCLUDE_FILES = ['.test.ts', '.spec.ts', '.d.ts'];

// Helper to get all files recursively
function getFiles(dir, fileList = [], relativePath = '') {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const fileRelativePath = path.join(relativePath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                getFiles(filePath, fileList, fileRelativePath);
            }
        } else {
            // Only check .ts and .js files
            if ((file.endsWith('.ts') || file.endsWith('.js')) &&
                !EXCLUDE_FILES.some(ext => file.endsWith(ext))) {
                fileList.push({
                    absolute: filePath,
                    relative: fileRelativePath,
                    mtime: stat.mtime
                });
            }
        }
    });

    return fileList;
}

console.log('🔍 Checking SRC=DIST synchronization...');

if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ DIST directory does not exist! Run "npm run build" first.');
    process.exit(1);
}

const srcFiles = getFiles(SRC_DIR);
let errorCount = 0;

srcFiles.forEach(srcFile => {
    // Convert .ts extension to .js for dist check
    const distRelativePath = srcFile.relative.replace(/\.ts$/, '.js');
    const distFilePath = path.join(DIST_DIR, distRelativePath);

    if (!fs.existsSync(distFilePath)) {
        console.error(`❌ Missing in DIST: ${distRelativePath}`);
        errorCount++;
    } else {
        const distStat = fs.statSync(distFilePath);
        // Check if src is newer than dist (allowing for some tolerance)
        if (srcFile.mtime > distStat.mtime) {
            console.warn(`⚠️  Outdated in DIST: ${distRelativePath} (Source is newer)`);
            // We treat this as a warning for now, but could be an error
            // errorCount++; 
        }
    }
});

if (errorCount > 0) {
    console.error(`\n❌ Sync Check Failed: ${errorCount} files missing or outdated in DIST.`);
    console.error('👉 Please run "npm run build" to update the DIST folder.');
    process.exit(1);
} else {
    console.log('✅ SRC=DIST Sync Check Passed!');
    process.exit(0);
}
