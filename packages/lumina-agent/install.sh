#!/bin/bash
# Lumina Code Installer - macOS / Linux
# Usage: curl -fsSL https://lumina.ai/install.sh | bash

set -e

echo ""
echo "  LUMINA CODE - AI Coding Agent"
echo "  =============================="
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"
echo "  Detected: $OS ($ARCH)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js 18+ required. Install from https://nodejs.org/"
    exit 1
fi
echo "  Node.js: $(node -v)"

# Check git
if ! command -v git &> /dev/null; then
    echo "  ERROR: git required. Install from https://git-scm.com/"
    exit 1
fi

# Package manager
PM="npm"
if command -v bun &> /dev/null; then PM="bun"; echo "  Using bun"; else echo "  Using npm"; fi

# Clone repo
REPO="$HOME/.lumina/repo"
if [ -d "$REPO" ]; then
    echo "  Updating repo..."
    git -C "$REPO" pull --quiet 2>/dev/null || true
else
    echo "  Cloning repo..."
    mkdir -p "$HOME/.lumina"
    git clone --depth 1 https://github.com/achyutunitarun-coder/luminaaistudywebsite.git "$REPO" 2>/dev/null || {
        echo "  ERROR: Failed to clone repo. Make sure you have internet access."
        exit 1
    }
fi

# Build
AGENT="$REPO/packages/lumina-agent"
echo ""
echo "  Building Lumina Code..."
cd "$AGENT"

if [ "$PM" = "bun" ]; then
    bun install --silent 2>/dev/null
else
    npm install --silent 2>/dev/null
fi

# Compile TypeScript
if [ -f "$AGENT/node_modules/.bin/tsc" ]; then
    "$AGENT/node_modules/.bin/tsc" -p "$AGENT/tsconfig.json" 2>/dev/null || npx -y typescript@latest tsc -p "$AGENT/tsconfig.json" 2>/dev/null || true
fi

# Link globally
echo "  Linking lumina command..."
cd "$AGENT"
npm link 2>/dev/null || sudo npm link 2>/dev/null || {
    # Fallback: create alias in ~/.local/bin
    mkdir -p "$HOME/.local/bin"
    ln -sf "$AGENT/src/index.ts" "$HOME/.local/bin/lumina" 2>/dev/null || true
    echo "  Created symlink at ~/.local/bin/lumina"
    echo "  Make sure ~/.local/bin is in your PATH"
    echo '  Add this to your ~/.bashrc or ~/.zshrc: export PATH="$HOME/.local/bin:$PATH"'
}

echo ""
echo "  Lumina Code installed!"
echo ""
echo "  Next steps:"
echo "    lumina config set openrouter-key YOUR_KEY"
echo "    lumina code"
echo ""
echo "  Get API key: https://openrouter.ai/keys"
echo ""
