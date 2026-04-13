#!/bin/sh
set -e

# Support both REDIS_URL and REDIS_HOST/REDIS_PORT
if [ -n "$REDIS_URL" ]; then
    # Extract host and port from REDIS_URL
    # Support formats: redis://host:port, redis://user:pass@host:port
    host=$(echo "$REDIS_URL" | sed -e 's|redis://||' -e 's|/.*||' | awk -F[@] '{print $NF}' | cut -d: -f1)
    port=$(echo "$REDIS_URL" | sed -e 's|redis://||' -e 's|/.*||' | awk -F[@] '{print $NF}' | cut -d: -f2)
elif [ -n "$REDIS_HOST" ]; then
    host="$REDIS_HOST"
    port="${REDIS_PORT:-6379}"
else
    host="localhost"
    port="6379"
fi

echo "Waiting for Redis at $host:$port..."

# Wait for Redis to be ready (up to 60 seconds)
i=1
while [ $i -le 60 ]; do
    if redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
        echo "Redis is ready!"
        exit 0
    fi
    echo "Waiting... ($i/60)"
    sleep 1
    i=$((i + 1))
done

echo "ERROR: Redis is not available after 60 seconds"
exit 1
