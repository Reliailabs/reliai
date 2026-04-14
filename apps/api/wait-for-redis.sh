#!/bin/sh
set -e

# Skip Redis wait if environment variable is set
if [ -n "$RELIAI_SKIP_REDIS_WAIT" ]; then
    echo "Skipping Redis wait (RELIAI_SKIP_REDIS_WAIT is set)"
    exit 0
fi

# Skip Redis wait if running on Railway (auto-connect)
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
    echo "Skipping Redis wait (RAILWAY_ENVIRONMENT detected)"
    exit 0
fi

# Support both REDIS_URL and REDIS_HOST/REDIS_PORT
if [ -n "$REDIS_URL" ]; then
    # Extract host and port from REDIS_URL
    # Support formats: redis://host:port, rediss://host:port, redis://user:pass@host:port
    # Remove protocol prefix
    no_proto=$(echo "$REDIS_URL" | sed -e 's|^redis://||' -e 's|^rediss://||')
    # Remove path after /
    no_path=$(echo "$no_proto" | sed -e 's|/.*||')
    # Extract auth if present (part before @)
    auth_part=$(echo "$no_path" | awk -F[@] '{print $1}')
    # Extract host and port (part after @, or whole if no @)
    hostport_part=$(echo "$no_path" | awk -F[@] '{print $NF}')
    host=$(echo "$hostport_part" | cut -d: -f1)
    port=$(echo "$hostport_part" | cut -d: -f2)
    # Extract password from auth (format user:password)
    if [ -n "$auth_part" ] && [ "$auth_part" != "$hostport_part" ]; then
        # auth_part may be ":" or "user:password"
        password=$(echo "$auth_part" | cut -d: -f2)
        if [ -n "$password" ]; then
            export REDISCLI_AUTH="$password"
        fi
    fi
    # Check if TLS is required
    if echo "$REDIS_URL" | grep -q "^rediss://"; then
        TLS_FLAG="--tls --insecure"
    else
        TLS_FLAG=""
    fi
elif [ -n "$REDIS_HOST" ]; then
    host="$REDIS_HOST"
    port="${REDIS_PORT:-6379}"
    TLS_FLAG=""
else
    host="localhost"
    port="6379"
    TLS_FLAG=""
fi

echo "Waiting for Redis at $host:$port (TLS: ${TLS_FLAG:-none})..."

# Build redis-cli command
REDIS_CLI_CMD="redis-cli"
if [ -n "$TLS_FLAG" ]; then
    REDIS_CLI_CMD="$REDIS_CLI_CMD $TLS_FLAG"
fi

# Wait for Redis to be ready (up to 60 seconds)
i=1
while [ $i -le 60 ]; do
    if $REDIS_CLI_CMD -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
        echo "Redis is ready!"
        exit 0
    fi
    echo "Waiting... ($i/60)"
    sleep 1
    i=$((i + 1))
done

echo "ERROR: Redis is not available after 60 seconds"
exit 1
