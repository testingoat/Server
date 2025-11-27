import fs from 'fs';
import path from 'path';

export class EnvEditorService {
    constructor() {
        this.rootDir = process.cwd();

        // Detect highest-priority env file that exists, mirroring app.ts load order
        const NODE_ENV = process.env.NODE_ENV || 'development';
        const envFiles = [
            `.env.${NODE_ENV}`,        // .env.production, .env.staging, etc.
            '.env.local',               // Local overrides (not in git)
            '.env'                      // Default fallback
        ];

        // Find the first existing env file (highest priority)
        this.envFilename = '.env'; // default
        for (const envFile of envFiles) {
            const fullPath = path.join(this.rootDir, envFile);
            if (fs.existsSync(fullPath)) {
                this.envFilename = envFile;
                break;
            }
        }

        this.envPath = path.join(this.rootDir, this.envFilename);
        this.backupDir = path.join(this.rootDir, 'backups', 'env');

        console.log(`📝 Env Editor: Editing file "${this.envFilename}" (NODE_ENV=${NODE_ENV})`);
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    parseEnvFile(content) {
        const lines = content.split(/\r?\n/);
        const parsed = [];

        for (const line of lines) {
            if (!line.trim()) {
                parsed.push({ type: 'blank', raw: line });
                continue;
            }

            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                parsed.push({ type: 'comment', raw: line });
                continue;
            }

            const idx = line.indexOf('=');
            if (idx <= 0) {
                parsed.push({ type: 'other', raw: line });
                continue;
            }

            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1); // preserve raw value including quotes
            parsed.push({ type: 'kv', raw: line, key, value });
        }

        return parsed;
    }

    getEnvVariables() {
        let content = '';
        if (fs.existsSync(this.envPath)) {
            content = fs.readFileSync(this.envPath, 'utf8');
        }

        const parsed = this.parseEnvFile(content);
        const variables = parsed
            .filter((line) => line.type === 'kv' && line.key)
            .map((line) => ({ key: line.key, value: line.value }));

        // Return variables with metadata about which file is being edited
        return {
            variables,
            filename: this.envFilename,
            path: this.envPath
        };
    }

    updateEnvVariables(variables) {
        if (!Array.isArray(variables)) {
            throw new Error('variables must be an array');
        }

        const map = new Map();
        for (const v of variables) {
            if (!v || typeof v.key !== 'string') continue;
            const key = v.key.trim();
            if (!key) continue;
            const value = v.value == null ? '' : String(v.value);
            map.set(key, value);
        }

        let existingContent = '';
        if (fs.existsSync(this.envPath)) {
            existingContent = fs.readFileSync(this.envPath, 'utf8');
        }

        // Backup current env file if it exists
        this.ensureBackupDir();
        if (fs.existsSync(this.envPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Include the target filename in backup name for clarity
            const sanitizedFilename = this.envFilename.replace(/\./g, '_');
            const backupName = `${sanitizedFilename}-${timestamp}.bak`;
            const backupPath = path.join(this.backupDir, backupName);
            fs.copyFileSync(this.envPath, backupPath);
            console.log(`✅ Created backup: ${backupName}`);
        }

        const parsed = this.parseEnvFile(existingContent);
        const usedKeys = new Set();
        const newLines = [];

        for (const line of parsed) {
            if (line.type === 'kv' && line.key) {
                if (map.has(line.key)) {
                    const value = map.get(line.key);
                    newLines.push(`${line.key}=${value}`);
                    usedKeys.add(line.key);
                } else {
                    newLines.push(line.raw);
                }
            } else {
                newLines.push(line.raw);
            }
        }

        // Append new keys that did not exist before
        for (const [key, value] of map.entries()) {
            if (!usedKeys.has(key)) {
                newLines.push(`${key}=${value}`);
            }
        }

        const newContent = newLines.join('\n') + '\n';
        const validation = this.validateEnvFile(newContent);
        if (!validation.valid) {
            throw new Error(`Invalid env file: ${validation.error}`);
        }

        fs.writeFileSync(this.envPath, newContent, 'utf8');
        return { success: true };
    }

    validateEnvFile(content) {
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx <= 0) {
                return { valid: false, error: `Invalid line: ${trimmed}` };
            }
        }
        return { valid: true };
    }
}

