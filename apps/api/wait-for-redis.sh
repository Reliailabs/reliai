#!/bin/sh
set -e

REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}

# Extract host and port from REDIS_URL
# Support formats: redis://host:port, redis://user:pass@host:port
host=$(echo "$REDIS_URL" | sed -e 's|redis://||' -e 's|/.*||' | awk -F[@] '{print $NF}' | cut -d: -f1)
port=$(echo "$REDIS_URL" | sed -e 's|redis://||' -e 's|/.*||' | awk -F[@] '{print $NF}' | cut -d: -f2)

echo "Waiting for Redis at $host:$port..."

# Wait for Redis to be ready (up to 30 seconds)
i=1
while [ $i -le 30 ]; do
    if redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
        echo "Redis is ready!"
        exit 0
    fi
    echo "Waiting... ($i/30)"
    sleep 1
    i=$((i + 1))
done

echo "ERROR: Redis is not available after 30 seconds"
exit 1
