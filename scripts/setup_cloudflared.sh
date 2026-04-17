#!/bin/bash
# Node 2: Cloudflare Tunnel Setup Script
set -e

echo "[Cloudflare] Installing cloudflared..."

# For Debian/Ubuntu
if command -v apt-get &>/dev/null; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    echo "cloudflared installed."
else
    echo "Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

echo ""
echo "[Cloudflare] Creating tunnel..."
echo "Run: cloudflared tunnel create voxbridge-tunnel"
echo "Then: cloudflared tunnel route dns voxbridge-tunnel voxbridge.yourdomain.com"
echo "Then: cloudflared tunnel run voxbridge-tunnel"
