#!/bin/bash

# CantoFlow Stop Script

echo "🛑 Stopping CantoFlow..."

# Kill processes on ports 3000 and 4000
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "Stopping frontend (port 3000)..."
    kill -9 $(lsof -ti:3000) 2>/dev/null || true
fi

if lsof -ti:4000 >/dev/null 2>&1; then
    echo "Stopping backend (port 4000)..."
    kill -9 $(lsof -ti:4000) 2>/dev/null || true
fi

# Stop Docker containers
echo "Stopping databases..."
docker-compose down

# Clean up log files
if [ -f backend.log ]; then
    rm backend.log
fi

if [ -f frontend.log ]; then
    rm frontend.log
fi

echo "✓ CantoFlow stopped"
