# lumina-ai-cli — Personal AI Assistant CLI

Chat with AI models from OpenAI, Anthropic, Google (Gemini), Groq, Together AI, and custom endpoints — all from your terminal.

## Installation

```bash
npm install -g lumina-ai-cli
```

## Quick Start

```bash
lumina
```

On first run, you'll be guided through:
1. Choosing an API provider
2. Entering your API key (stored locally, never shared)
3. Selecting a default model
4. Picking a persona
5. Setting your token budget

## Commands

| Command | Description |
|---------|-------------|
| `lumina` | Start the interactive TUI |
| `lumina --config` | Re-run setup |
| `lumina --model <name>` | Override model for session |
| `lumina --persona <name>` | Override persona for session |
| `lumina --budget <n>` | Override token budget |
| `lumina --help` | Show help |
| `lumina --version` | Show version |

### In-Chat Commands

| Command | Description |
|---------|-------------|
| `:q` or `:quit` | Exit |
| `:m <model>` | Switch model |
| `:p <persona>` | Switch persona |
| `:b <budget>` | Switch token budget |
| `:clear` | Clear chat history |
| `:save <filename>` | Save conversation to file |

## Provider Setup

### OpenAI
Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Anthropic
Get your API key from [console.anthropic.com](https://console.anthropic.com)

### Google (Gemini)
Get your API key from [aistudio.google.com](https://aistudio.google.com)

### Groq
Get your API key from [console.groq.com](https://console.groq.com)

### Together AI
Get your API key from [api.together.xyz](https://api.together.xyz)

### Custom
Any OpenAI-compatible endpoint. Provide your base URL and API key.

## Personas

- **Planner** — Technical architecture and project planning
- **Coder** — Senior software engineer for clean code
- **Reviewer** — Brutal code review with severity ratings
- **Fixer** — Debugger with minimal fixes
- **General** — Default helpful assistant

## Token Efficiency

Lumina is built for extreme token efficiency:
- Personas enforce concise responses (default 256 tokens)
- Every 10 turns, conversation is summarized into a compact memory block
- Real-time token count and cost display
- Early truncation when budget exceeded

## Troubleshooting

Invalid API key: Run `lumina --config` to update your key.
Rate limited: Wait or switch models with `:m <model>`.
Connection failed: Check your internet connection and API endpoint.
Model not found: Run `lumina --config` to see available models.

## License

MIT
