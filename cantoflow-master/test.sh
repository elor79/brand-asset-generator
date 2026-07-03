#!/bin/bash

# CantoFlow Health & Test Script

echo "🔍 CantoFlow System Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Function to test
test_service() {
    local name=$1
    local command=$2

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAIL++))
    fi
}

test_http() {
    local name=$1
    local url=$2
    local expected=$3

    code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$code" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $code)"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $name (HTTP $code, expected $expected)"
        ((FAIL++))
    fi
}

# Docker Tests
echo "📦 Docker Services:"
test_service "MongoDB container" "docker ps | grep -q cantoflow-mongodb"
test_service "Redis container" "docker ps | grep -q cantoflow-redis"
echo ""

# Port Tests
echo "🔌 Network Ports:"
test_service "Port 3000 (Frontend)" "lsof -i:3000 -sTCP:LISTEN -t"
test_service "Port 4000 (Backend)" "lsof -i:4000 -sTCP:LISTEN -t"
echo ""

# Backend API Tests
echo "🔧 Backend API:"
test_http "Health endpoint" "http://localhost:4000/health" "200"
test_http "Templates endpoint" "http://localhost:4000/api/templates" "200"
test_http "Social presets" "http://localhost:4000/api/render/social-presets" "200"
echo ""

# Frontend Tests
echo "🎨 Frontend Pages:"
test_http "Homepage" "http://localhost:3000/" "200"
test_http "Templates page" "http://localhost:3000/templates" "200"
test_http "Assets page" "http://localhost:3000/assets" "200"
test_http "Editor page" "http://localhost:3000/editor" "200"
echo ""

# Database Tests
echo "💾 Database Connectivity:"
test_service "MongoDB connection" "curl -s http://localhost:4000/health | grep -q '\"status\":\"ok\"'"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASS + FAIL))

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC} ($PASS/$TOTAL)"
    echo ""
    echo "🎉 CantoFlow is running perfectly!"
    echo ""
    echo "Access your application:"
    echo -e "  Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "  Backend:  ${GREEN}http://localhost:4000${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC} ($FAIL/$TOTAL failed, $PASS/$TOTAL passed)"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if all services are running: ./start.sh"
    echo "  2. View logs: tail -f backend.log frontend.log"
    echo "  3. Check Docker: docker ps"
    exit 1
fi
