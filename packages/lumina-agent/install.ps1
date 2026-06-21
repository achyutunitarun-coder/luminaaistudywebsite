# Lumina Code Installer - Windows PowerShell
# Usage: irm https://lumina.ai/install.ps1 | iex

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

# Try npm/bun install first
$installed = $false
try {
    if ($installer -eq "bun") {
        bun install -g @lumina/agent 2>$null
    } else {
        npm install -g @lumina/agent 2>$null
    }
    if ($LASTEXITCODE -eq 0) {
        $installed = $true
        Write-Host "  Installed via $installer!" -ForegroundColor Green
    }
} catch {}

if (-not $installed) {
    Write-Host "  Building from source..." -ForegroundColor Yellow

    # Check git
    try { git -v 2>$null } catch {
        Write-Host "  ERROR: git required. Install from https://git-scm.com/" -ForegroundColor Red
        exit 1
    }

    $repo = "$env:USERPROFILE\.lumina\repo"
    if (Test-Path $repo) {
        git -C $repo pull --quiet 2>$null
    } else {
        New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.lumina" | Out-Null
        git clone --depth 1 https://github.com/achyutunitarun-coder/luminaaistudywebsite.git $repo
    }

    $agent = "$repo\packages\lumina-agent"
    Set-Location $agent

    if ($installer -eq "bun") {
        bun install --silent 2>$null
    } else {
        npm install --silent 2>$null
    }

    # Compile
    if (Test-Path "$agent\node_modules\.bin\tsc.cmd") {
        & "$agent\node_modules\.bin\tsc.cmd" -p "$agent\tsconfig.json" 2>$null
    }

    # Link
    Set-Location $agent
    npm link 2>$null

    Write-Host "  Built and linked from source!" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Lumina Code installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    lumina config set openrouter-key YOUR_KEY" -ForegroundColor White
Write-Host "    lumina code" -ForegroundColor White
Write-Host ""
