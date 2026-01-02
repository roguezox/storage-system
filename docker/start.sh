#!/bin/sh
set -e

echo "Starting OpenDrive..."

# Start backend in background
echo "Starting backend on port 5000..."
cd /app/backend
node app.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if wget -q --spider http://127.0.0.1:5000/api/health 2>/dev/null; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Start frontend in background
echo "Starting frontend on port 3000..."
cd /app/frontend
PORT=3000 HOSTNAME=0.0.0.0 node server.js &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "Waiting for frontend..."
for i in $(seq 1 30); do
    if wget -q --spider http://127.0.0.1:3000 2>/dev/null; then
        echo "Frontend is ready!"
        break
    fi
    sleep 1
done

# Start nginx in foreground
echo "Starting nginx on port 8080..."
nginx -g "daemon off;"
