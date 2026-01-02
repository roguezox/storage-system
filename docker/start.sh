#!/bin/bash
set -e

echo "=== Starting OpenDrive ==="

# Start MongoDB
echo "[1/4] Starting MongoDB..."
mongod --bind_ip 127.0.0.1 --dbpath /data/db --fork --logpath /var/log/mongodb.log
sleep 2

# Start backend
echo "[2/4] Starting backend on port 5000..."
cd /app/backend
export NODE_ENV=production
export MONGODB_URI=mongodb://localhost:27017/drive
node app.js > /var/log/backend.log 2>&1 &
sleep 2

# Verify backend
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "    Backend is running!"
else
    echo "    WARNING: Backend health check failed"
    cat /var/log/backend.log
fi

# Start frontend
echo "[3/4] Starting frontend on port 3000..."
cd /app/frontend
PORT=3000 HOSTNAME=0.0.0.0 node server.js > /var/log/frontend.log 2>&1 &
sleep 3

# Verify frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo "    Frontend is running!"
else
    echo "    WARNING: Frontend health check failed"
    echo "    Frontend logs:"
    cat /var/log/frontend.log
fi

# Start nginx
echo "[4/4] Starting nginx on port 8080..."
nginx -g "daemon off;"
