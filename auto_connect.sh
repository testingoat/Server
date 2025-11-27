#!/bin/bash
# auto_connect.sh
# Automates SSH connection setup for srv1007003 (147.93.108.121)

SERVER_IP="147.93.108.121"
USER="root"
PASSWORD="$1"

# 1. Install dependencies (sshpass)
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass..."
    # Suppress output for cleaner logs, but show errors
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq sshpass
fi

# 2. Check for Password
if [ -z "$PASSWORD" ]; then
    echo "Usage: ./auto_connect.sh <PASSWORD>"
    echo "Please provide the password as an argument."
    exit 1
fi

# 3. Generate SSH Key (if needed)
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "Generating new SSH key pair..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q
else
    echo "SSH key already exists."
fi

# 4. Copy Public Key to Server
echo "Authorizing key on server..."
sshpass -p "$PASSWORD" ssh-copy-id -i ~/.ssh/id_ed25519.pub -o StrictHostKeyChecking=no $USER@$SERVER_IP

# 5. Verify Connection
echo "Verifying connection..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=no $USER@$SERVER_IP "echo 'SUCCESS: Connected to \$(hostname)'"
