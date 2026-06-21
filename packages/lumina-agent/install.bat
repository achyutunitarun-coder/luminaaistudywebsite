#!/bin/bash
# Lumina Code Installer - Windows (via Git Bash / MSYS2 / WSL)
# Usage: curl -fsSL https://luminaai.co.in/install.sh | bash

set -e

echo ""
echo "  LUMINA CODE - AI Coding Agent (Windows)"
echo "  ========================================="
echo ""

# Detect shell
SHELL_NAME=$(basename "$SHELL")
echo "  Shell: $SHELL_NAME"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js not found."
    echo "  Install from: https://nodejs.org/ (LTS recommended)"
    echo "  Or use winget: winget install OpenJS.NodeJS.LTS"
    exit 1
fi

echo "  Node.js: $(node -v)"

# Check for bun (preferred) or npm
if command -v bun &> /dev/null; then
    INSTALLER="bun"
    echo "  Package manager: bun ($(bun -v))"
else
    INSTALLER="npm"
    echo "  Package manager: npm ($(npm -v))"
fi

echo ""
echo "  Installing Lumina Code..."
echo ""

if [ "$INSTALLER" = "bun" ]; then
    bun install -g lumina-agent
else
    npm install -g lumina-agent
fi

echo ""
echo "  Lumina Code installed successfully!"
echo ""
echo "  Next steps:"
echo "    1. lumina config set openrouter-key YOUR_KEY"
echo "    2. lumina code"
echo ""
