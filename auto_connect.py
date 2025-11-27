import paramiko
import os
import sys
import subprocess

SERVER_IP = "147.93.108.121"
USER = "root"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else None

if not PASSWORD:
    print("Usage: python auto_connect.py <PASSWORD>")
    sys.exit(1)

ssh_dir = os.path.expanduser("~/.ssh")
key_path = os.path.join(ssh_dir, "id_ed25519")
pub_key_path = key_path + ".pub"

if not os.path.exists(ssh_dir):
    os.makedirs(ssh_dir)

if not os.path.exists(key_path):
    print("Generating SSH key...")
    # Use ssh-keygen from system path
    try:
        subprocess.run(["ssh-keygen", "-t", "ed25519", "-f", key_path, "-N", ""], check=True)
    except FileNotFoundError:
        print("ssh-keygen not found. Please install OpenSSH.")
        sys.exit(1)

with open(pub_key_path, "r") as f:
    pub_key = f.read().strip()

print(f"Connecting to {SERVER_IP}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(SERVER_IP, username=USER, password=PASSWORD)
    
    print("Checking authorized_keys...")
    stdin, stdout, stderr = ssh.exec_command("mkdir -p ~/.ssh && cat ~/.ssh/authorized_keys")
    authorized_keys = stdout.read().decode()
    
    if pub_key in authorized_keys:
        print("Key already authorized.")
    else:
        print("Adding key to authorized_keys...")
        # Append key. Be careful with quotes in pub_key (usually safe)
        cmd = f"echo \"{pub_key}\" >> ~/.ssh/authorized_keys"
        ssh.exec_command(cmd)
        print("Key added.")
        
    print("Verifying connection...")
    stdin, stdout, stderr = ssh.exec_command("hostname")
    print(f"Connected to: {stdout.read().decode().strip()}")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
finally:
    ssh.close()
