#!/bin/sh
set -e

# Generate runtime config from environment variable
echo "Injecting API_URL: ${API_URL:-not set}"

# Create config.js that sets window.__API_URL__
cat > /app/public/config.js << EOF
window.__API_URL__ = "${API_URL}";
EOF

echo "Config injected, starting Next.js..."
exec node server.js
