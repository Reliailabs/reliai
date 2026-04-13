#!/bin/bash
set -e

REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}

# Extract host and port from REDIS_URL
# Support formats: redis://host:port, redis://user:pass@host:port
parse_redis_url() {
    local url="$1"
    # Remove redis:// prefix
    local stripped="${url#redis://}"

    # Check if there's authentication info
    if [[ "$stripped" == *"@"* ]]; then
        # Extract host:port after @
        local auth_and_host="${stripped#*@}"
        host="${auth_and_host%%:*}"
        port="${auth_and_host#*:}"
    else
        host="${stripped%%:*}"
        port="${stripped#*:}"
    fi

    # Remove any trailing path or query params
    port="${port%%/*}"

    echo "$host $port"
}

read host port <<< "$(parse_redis_url "$REDIS_URL")"

echo "Waiting for Redis at $host:$port..."

# Wait for Redis to be ready (up to 30 seconds)
for i in {1..30}; do
    if redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
        echo "Redis is ready!"
        exit 0
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

echo "ERROR: Redis is not available after 30 seconds"
exit 1
