#!/bin/bash
# Lumina Code Installer - macOS / Linux
# Usage: curl -fsSL https://luminaai.co.in/install.sh | bash

set -e

echo ""
echo "  LUMINA CODE - AI Coding Agent"
echo "  =============================="
echo ""

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"
echo "  Detected: $OS ($ARCH)"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js not found. Please install Node.js 18+ first."
    echo "  Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "  ERROR: Node.js version must be 18+. Found: $(node -v)"
    exit 1
fi

echo "  Node.js: $(node -v)"

# Check for bun (preferred) or npm
INSTALLER="npm"
if command -v bun &> /dev/null; then
    INSTALLER="bun"
    echo "  Package manager: bun ($(bun -v))"
else
    echo "  Package manager: npm ($(npm -v))"
fi

# Install
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
echo "    1. Set your API key: lumina config set openrouter-key YOUR_KEY"
echo "    2. Start coding:     lumina code"
echo ""
echo "  Get your API key at: https://openrouter.ai/keys"
echo ""
