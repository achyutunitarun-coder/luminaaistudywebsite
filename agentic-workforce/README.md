# Lumina Work

A multi-agent AI team in your terminal. Chat with experienced AI engineers, PMs, and security experts who collaborate to solve your problems.

```
$ lumina-work
```

Your team includes:

| Agent | Role | Specialty |
|-------|------|-----------|
| **Sarah Chen** | CEO & Strategic Lead | Big picture, delegation, strategy |
| **Marcus Johnson** | VP of Engineering | Architecture, systems, code reviews |
| **Elena Rodriguez** | Product Manager | Specs, user research, prioritization |
| **Dr. James Okafor** | Security Lead | Threat modeling, auth, compliance |
| **Aisha Patel** | Senior Engineer | Full-stack, clean code, performance |
| **Kai Tanaka** | Software Engineer | Documentation, testing, fresh ideas |
| **Priya Sharma** | QA & Test Lead | Edge cases, automation, quality |

## Quick Start

```bash
# Install
npm install -g lumina-work

# Start the chat
lumina-work

# Configure providers
lumina-work --configure
```

## What it can do

Ask about anything — the AI team routes your question to the right expert:

- **Code**: "Review this function for security issues" → Security + Engineering
- **Architecture**: "Design a rate limiter for our API" → VP Eng + Senior Dev
- **Product**: "What should our onboarding flow look like?" → PM + CEO
- **Strategy**: "Should we build or buy our auth system?" → CEO + Security + VP Eng

## How it works

Unlike rigid agent pipelines, Lumina Work uses experienced personas who:
- Understand context and nuance
- Collaborate naturally (like a real team)
- Route questions to the right expert automatically
- Give honest, practical advice

The system connects to OpenAI, Anthropic, Groq, Google, or any OpenAI-compatible provider.

## Requirements

- Node.js >= 18
- At least one LLM provider configured

## License

MIT
