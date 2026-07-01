# Lumina Code - AI Coding Agent

The most powerful AI coding agent. Runs locally on your machine. Full filesystem access. Multi-model intelligence. Beautiful TUI.

## Install

### macOS / Linux
```bash
curl -fsSL https://luminaai.co.in/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://luminaai.co.in/install.ps1 | iex
```

### npm (any platform)
```bash
npm install -g lumina-agent
```

### bun (any platform)
```bash
bun install -g lumina-agent
```

## Quick Start

```bash
# 1. Set your OpenRouter API key
lumina config set openrouter-key YOUR_KEY

# 2. Start building
lumina code "Build me a React app with Tailwind"

# 3. Or start interactive mode
lumina code
```

## Commands

| Command | Description |
|---------|-------------|
| `lumina code [prompt]` | Start Lumina Code agent |
| `lumina code -y [prompt]` | Auto-approve all actions |
| `lumina code -m <model> [prompt]` | Use specific model |
| `lumina config` | Show configuration |
| `lumina config set <key> <value>` | Set config value |

## Models

| Model | Use Case |
|-------|----------|
| `meta-llama/llama-3.3-70b-instruct:free` | Planning & reasoning (default) |
| `moonshotai/kimi-k2.6` | Code generation |
| `openai/gpt-oss-20b:free` | Fast tasks |

## Agent Tools

- **bash** - Run any shell command
- **read_file** - Read file contents
- **write_file** - Create or overwrite files
- **edit_file** - Make precise edits
- **list_dir** - List directory contents
- **search_files** - Find files by pattern
- **grep** - Search file contents
- **git** - Git operations
- **npm** - Package management
- **deploy** - Deploy to Vercel
- **ask** - Ask user for input

## Configuration

Config stored at `~/.lumina/config.json`:

```json
{
  "openrouterKey": "sk-or-...",
  "defaultModel": "meta-llama/llama-3.3-70b-instruct:free",
  "codingModel": "moonshotai/kimi-k2.6",
  "fastModel": "openai/gpt-oss-20b:free"
}
```

## Get API Key

Get your OpenRouter API key at: https://openrouter.ai/keys
