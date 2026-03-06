#!/bin/bash

# Development startup script - runs both backend and frontend
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if directories exist
if [ ! -f "pyproject.toml" ] || [ ! -d "ui" ]; then
    echo -e "${RED}❌ Error: Please run this script from the M4.Manager root directory${NC}"
    exit 1
fi

# Create necessary directories
mkdir -p downloads/.metube
mkdir -p ui/dist/metube/browser

# Determine Python command
if command -v uv &> /dev/null; then
    PYTHON_CMD="uv run python"
else
    PYTHON_CMD="python3"
fi

# Determine package manager
cd ui
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
else
    echo -e "${RED}❌ Error: No package manager (pnpm/npm) found${NC}"
    exit 1
fi
cd ..

# Check if frontend is built
if [ ! -d "ui/dist/metube/browser" ] || [ -z "$(ls -A ui/dist/metube/browser 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Frontend not built. Building now...${NC}"
    cd ui
    if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
        pnpm run build
    else
        npm run build
    fi
    cd ..
fi

# Set environment variables
export DOWNLOAD_DIR="${PWD}/downloads"
export AUDIO_DOWNLOAD_DIR="${PWD}/downloads"
export STATE_DIR="${PWD}/downloads/.metube"
export TEMP_DIR="${PWD}/downloads"
export BASE_DIR="${PWD}"
export HOST="0.0.0.0"
export PORT="8081"
export LOGLEVEL="INFO"
export DEFAULT_THEME="auto"
export MAX_CONCURRENT_DOWNLOADS="3"
export CUSTOM_DIRS="true"
export CREATE_CUSTOM_DIRS="true"

echo -e "${GREEN}🚀 Starting M4.Manager Development Server...${NC}"
echo ""
echo -e "${BLUE}Backend:${NC}  http://localhost:${PORT}"
echo -e "${BLUE}Frontend:${NC} Building and serving..."
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}🐍 Starting Python backend...${NC}"
$PYTHON_CMD app/main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend dev server
echo -e "${BLUE}📦 Starting Angular dev server...${NC}"
cd ui
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm start &
else
    npm start &
fi
FRONTEND_PID=$!
cd ..

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
