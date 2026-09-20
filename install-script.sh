#!/usr/bin/env bash
set -e

echo "🔌 Releasing port 3000 if in use..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -t -i:3000 | xargs kill -9 >/dev/null 2>&1 || true
else
  PID=$(ss -tulpn 2>/dev/null | grep -E "(:3000|sport = :3000)" | awk '{print $7}' | grep -oE "[0-9]+" | head -n 1 || true)
  if [ ! -z "$PID" ]; then
    echo "Killing process $PID using port 3000..."
    kill -9 "$PID" >/dev/null 2>&1 || true
  fi
fi

echo "📦 Checking and installing zip/unzip prerequisites..."
if ! command -v zip >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
  echo "Installing zip and unzip via apt-get..."
  DEBIAN_FRONTEND=noninteractive apt-get update -y && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
    zip unzip
fi

echo "🦕 Checking Deno installation..."
export PATH="/root/.deno/bin:$HOME/.deno/bin:/usr/local/bin:$PATH"

if ! command -v deno >/dev/null 2>&1; then
  echo "Installing Deno unattended (-y)..."
  curl -fsSL https://deno.land/install.sh | sh -s -- -y
  mkdir -p /usr/local/bin
  ln -sf /root/.deno/bin/deno /usr/local/bin/deno || true
  ln -sf /root/.deno/bin/deno /usr/bin/deno || true
fi

echo "✅ Deno ready: $(deno --version | head -n 1)"

export PORT=3000
