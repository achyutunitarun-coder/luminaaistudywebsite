# Lumina Code Installer - Windows PowerShell
# Usage: irm https://luminaai.co.in/install.ps1 | iex

Write-Host ""
Write-Host "  LUMINA CODE - AI Coding Agent (Windows)" -ForegroundColor Magenta
Write-Host "  ========================================" -ForegroundColor Magenta
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found." -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "  Or: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    exit 1
}

# Check for bun or npm
$installer = "npm"
try {
    $bunVersion = bun -v
    $installer = "bun"
    Write-Host "  Package manager: bun ($bunVersion)" -ForegroundColor Green
} catch {
    $npmVersion = npm -v
    Write-Host "  Package manager: npm ($npmVersion)" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Installing Lumina Code..." -ForegroundColor Cyan
Write-Host ""

if ($installer -eq "bun") {
    bun install -g lumina-agent
} else {
    npm install -g lumina-agent
}

Write-Host ""
Write-Host "  Lumina Code installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. lumina config set openrouter-key YOUR_KEY" -ForegroundColor White
Write-Host "    2. lumina code" -ForegroundColor White
Write-Host ""
