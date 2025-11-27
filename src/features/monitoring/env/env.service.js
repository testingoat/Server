import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust path to point to root .env.local
// Current: src/features/monitoring/env/env.service.js
// Root: ../../../../.env.local
const ENV_PATH = path.resolve(__dirname, '../../../../.env.local');
const BACKUP_PATH = path.resolve(__dirname, '../../../../.env.local.bak');

class EnvService {
    async getEnvVars() {
        try {
            const content = await fs.readFile(ENV_PATH, 'utf-8');
            return this.parseEnv(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist
            }
            throw error;
        }
    }

    async saveEnvVars(newVars) {
        try {
            // 1. Read current content for backup
            let currentContent = '';
            try {
                currentContent = await fs.readFile(ENV_PATH, 'utf-8');
                // 2. Create backup
                await fs.writeFile(BACKUP_PATH, currentContent);
            } catch (err) {
                // Ignore if file doesn't exist, but log it
                console.warn('No existing .env.local to backup or read.');
            }

            // 3. Generate new content
            const newContent = this.stringifyEnv(newVars);

            // 4. Write new content
            await fs.writeFile(ENV_PATH, newContent);

            return { success: true };
        } catch (error) {
            console.error('Error saving .env file:', error);
            throw error;
        }
    }

    parseEnv(content) {
        const lines = content.split('\n');
        const vars = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                let value = trimmed.substring(eqIdx + 1).trim();

                // Remove surrounding quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                vars.push({ key, value });
            }
        }
        return vars;
    }

    stringifyEnv(vars) {
        return vars.map(v => `${v.key}=${v.value}`).join('\n');
    }
}

export const envService = new EnvService();
