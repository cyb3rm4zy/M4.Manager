#!/bin/bash

# Development setup script for M4.Manager
set -e

echo "🎵 Setting up M4.Manager development environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ] || [ ! -d "ui" ]; then
    echo "❌ Error: Please run this script from the M4.Manager root directory"
    exit 1
fi

# Create directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p downloads/.metube
mkdir -p ui/dist

# Setup Python backend
echo -e "${BLUE}🐍 Setting up Python backend...${NC}"
if command -v uv &> /dev/null; then
    echo "Using uv for Python dependencies..."
    uv sync --dev
    PYTHON_CMD="uv run python"
else
    echo "⚠️  uv not found. Using system Python (make sure dependencies are installed)"
    PYTHON_CMD="python3"
fi

# Setup Frontend
echo -e "${BLUE}📦 Setting up Frontend dependencies...${NC}"
cd ui
if command -v pnpm &> /dev/null; then
    echo "Using pnpm..."
    corepack enable 2>/dev/null || true
    pnpm install
    PACKAGE_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
    echo "Using npm..."
    npm install
    PACKAGE_MANAGER="npm"
else
    echo "❌ Error: No package manager (pnpm/npm) found"
    exit 1
fi
cd ..

# Build frontend for development
echo -e "${BLUE}🔨 Building frontend...${NC}"
cd ui
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm run build
else
    npm run build
fi
cd ..

echo -e "${GREEN}✅ Development environment setup complete!${NC}"
echo ""
echo -e "${YELLOW}To start the development server:${NC}"
echo "  Backend:  $PYTHON_CMD app/main.py"
echo "  Frontend: cd ui && $PACKAGE_MANAGER start"
echo ""
echo -e "${YELLOW}Or use the dev-start.sh script to run both:${NC}"
echo "  ./dev-start.sh"
