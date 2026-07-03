#!/bin/bash

# CantoFlow Startup Script
# Manages all services in one terminal

set -e

echo "🚀 Starting CantoFlow..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down CantoFlow...${NC}"

    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend..."
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ CantoFlow stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if port 3000 is occupied
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}✗ Port 3000 is already in use${NC}"
    echo "Checking what's using it..."
    lsof -i :3000 | grep LISTEN
    echo ""
    read -p "Do you want to kill the process using port 3000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -ti:3000)
        kill -9 $PID 2>/dev/null || true
        echo -e "${GREEN}✓ Killed process on port 3000${NC}"
    else
        echo -e "${YELLOW}Please stop the process manually and try again${NC}"
        exit 1
    fi
fi

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Start databases with Docker Compose
echo -e "${BLUE}Starting databases (MongoDB, Redis)...${NC}"
docker-compose up -d

# Wait for databases to be ready
echo "Waiting for databases to be ready..."
sleep 3

# Check if databases are running
if docker ps | grep -q "cantoflow-mongodb"; then
    echo -e "${GREEN}✓ MongoDB ready${NC}"
else
    echo -e "${RED}✗ MongoDB failed to start${NC}"
    exit 1
fi

if docker ps | grep -q "cantoflow-redis"; then
    echo -e "${GREEN}✓ Redis ready${NC}"
else
    echo -e "${YELLOW}⚠ Redis not running (optional, caching disabled)${NC}"
fi

echo ""
echo -e "${BLUE}Starting backend server...${NC}"

# Check if backend node_modules exists
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Start backend in background
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:4000/health > /dev/null; then
    echo -e "${GREEN}✓ Backend ready at http://localhost:4000${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    echo "Check backend.log for errors"
    cleanup
    exit 1
fi

echo ""
echo -e "${BLUE}Starting frontend server...${NC}"

# Check if frontend node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Start frontend in background
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "Waiting for frontend to start..."
sleep 8

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Frontend ready at http://localhost:3000${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    echo "Check frontend.log for errors"
    cleanup
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ CantoFlow is running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Services:"
echo -e "  • Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  • Backend:   ${BLUE}http://localhost:4000${NC}"
echo -e "  • Health:    ${BLUE}http://localhost:4000/health${NC}"
echo ""
echo "Logs:"
echo "  • Backend:   tail -f backend.log"
echo "  • Frontend:  tail -f frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Follow logs
tail -f backend.log frontend.log
