#!/usr/bin/env node

/**
 * File Watcher for Automated src→dist Synchronization
 * Phase 2A.2 Implementation
 */

import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SrcDistSyncer {
    constructor() {
        this.srcDir = './src';
        this.distDir = './dist';
        this.logFile = './logs/sync-watcher.log';
        this.isRunning = false;
        
        // Ensure logs directory exists
        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs', { recursive: true });
        }
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = '[' + timestamp + '] ' + message;
        console.log(logMessage);
        
        // Append to log file
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    async copyFile(srcPath, distPath) {
        try {
            // Ensure destination directory exists
            const distDir = path.dirname(distPath);
            if (!fs.existsSync(distDir)) {
                fs.mkdirSync(distDir, { recursive: true });
            }

            // Copy file
            fs.copyFileSync(srcPath, distPath);
            this.log(' Copied: ' + srcPath + '  ' + distPath);
            return true;
        } catch (error) {
            this.log(' Copy failed: ' + srcPath + '  ' + distPath + ' | Error: ' + error.message);
            return false;
        }
    }

    async handleFileChange(filePath) {
        try {
            // Convert src path to dist path
            const relativePath = path.relative(this.srcDir, filePath);
            let distPath = path.join(this.distDir, relativePath);

            // Handle TypeScript files - compile them
            if (filePath.endsWith('.ts')) {
                this.log(' TypeScript file changed: ' + filePath);
                
                // For TypeScript files, we need to compile them
                try {
                    await execAsync('npm run build');
                    this.log(' TypeScript compilation completed for: ' + filePath);
                } catch (buildError) {
                    this.log(' TypeScript compilation had errors, but continuing: ' + buildError.message);
                    // Even if compilation has errors, copy the .ts file as .js for compatibility
                    distPath = distPath.replace('.ts', '.js');
                    await this.copyFile(filePath, distPath);
                }
            } 
            // Handle JavaScript files - direct copy
            else if (filePath.endsWith('.js')) {
                this.log(' JavaScript file changed: ' + filePath);
                await this.copyFile(filePath, distPath);
            }
            // Handle other files (json, etc.) - direct copy
            else {
                this.log(' Other file changed: ' + filePath);
                await this.copyFile(filePath, distPath);
            }

        } catch (error) {
            this.log(' Error handling file change: ' + filePath + ' | Error: ' + error.message);
        }
    }

    start() {
        if (this.isRunning) {
            this.log(' Sync watcher is already running');
            return;
        }

        this.log(' Starting srcdist sync watcher...');
        this.isRunning = true;

        // Initialize watcher
        const watcher = chokidar.watch(this.srcDir, {
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/*.test.*',
                '**/temp_*',
                '**/*.backup*'
            ],
            persistent: true,
            ignoreInitial: true
        });

        // Handle file events
        watcher
            .on('add', (filePath) => {
                this.log(' File added: ' + filePath);
                this.handleFileChange(filePath);
            })
            .on('change', (filePath) => {
                this.log(' File changed: ' + filePath);
                this.handleFileChange(filePath);
            })
            .on('error', (error) => {
                this.log(' Watcher error: ' + error.message);
            })
            .on('ready', () => {
                this.log(' Sync watcher is ready and monitoring src/ directory');
                this.log(' Watching: ' + path.resolve(this.srcDir));
                this.log(' Syncing to: ' + path.resolve(this.distDir));
            });

        // Handle process termination
        process.on('SIGINT', () => {
            this.log(' Stopping sync watcher...');
            watcher.close();
            this.isRunning = false;
            process.exit(0);
        });
    }
}

// Start the syncer if this file is run directly
const syncer = new SrcDistSyncer();
syncer.start();
