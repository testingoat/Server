# Implementation Plan - CI/CD Setup

## Goal
Automate deployment to the production server using GitHub Actions, ensuring the server code always matches the repository ("Source of Truth").

## User Review Required
> [!IMPORTANT]
> **Server Reset**: We will **RESET** the server's `dist/` and `src/` directories to match the `main` branch. Any changes currently *only* on the server will be lost unless we back them up first.
> **Action**: I will perform a backup of the current server state to a separate branch or folder before resetting.

## Proposed Changes

### 1. Server Cleanup & Preparation
- **Backup**: SSH into server, create a backup of current `server` directory.
- **Git Reset**: Run `git reset --hard origin/main` to align server with GitHub.
- **SSH Key**: Generate a new SSH key pair for GitHub Actions to access the server.

### 2. Repository Configuration (User Action Needed)
You will need to add the following **Secrets** to your GitHub Repository (`Settings > Secrets and variables > Actions`):
- `SERVER_IP`: `147.93.108.121`
- `SSH_PRIVATE_KEY`: (I will generate this for you to copy-paste)
- `SSH_USER`: `root`

### 3. Codebase Changes

#### [NEW] `.github/workflows/deploy.yml`
The GitHub Action workflow file that triggers on push to `main`.

#### [NEW] `server/deploy.sh`
The shell script on the server that handles the actual update process (pull, build, restart).

## Verification Plan

### Automated Tests
- Push a dummy change to `README.md` on `main`.
- Verify GitHub Action runs successfully (Green checkmark).

### Manual Verification
- Check `pm2 logs` on server to see the restart.
- Verify the website is still accessible.
