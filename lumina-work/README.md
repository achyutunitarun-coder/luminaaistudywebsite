# lumina-work — AI Company Workforce Simulator

Simulate an entire AI-powered company in your terminal. Multiple AI agents work together as departments on your projects, communicating via @mentions, running meetings, and completing tasks.

## Installation

```bash
npm install -g lumina-work
```

## Quick Start

```bash
lumina-work
```

First run guides you through:
- Company name and project setup
- Team size (Small/Medium/Large)
- API provider configuration
- Model selection per department

## Commands

| Command | Description |
|---------|-------------|
| `lumina-work` | Launch TUI dashboard |
| `lumina-work --task "<desc>"` | Assign a task headlessly |
| `lumina-work --status` | Text status of all departments |
| `lumina-work --meeting` | Run sync meeting |
| `lumina-work --config` | Reconfigure company |
| `lumina-work --budget` | Show spending |
| `lumina-work --hire <dept>` | Add agents to department |
| `lumina-work --fire <dept>` | Remove agent from department |

### In-Dashboard Commands

| Command | Description |
|---------|-------------|
| `:q` | Quit |
| `:task <description>` | Assign a new task |
| `:meeting` | Run sync meeting |
| `:status` | Refresh department status |
| `:hire <department>` | Add an agent |
| `:fire <department>` | Remove an agent |
| `:budget` | Show budget usage |
| `:clear` | Clear status message |

## Departments

- **CEO** — Sets priorities, resolves conflicts, approves delivery
- **CTO** — Architecture decisions, technical review
- **Engineering** — Builds features, writes code, fixes bugs
- **Design** — UI/UX specs, wireframes, accessibility
- **QA** — Test plans, bug reports, release blocking
- **DevOps** — CI/CD, deployment, monitoring
- **Marketing** — Copywriting, campaigns, metrics

## Task Workflow

1. CEO receives and defines priority/scope
2. Routes to departments via @mentions
3. Agents execute and communicate
4. CTO reviews technical decisions
5. QA validates output
6. DevOps deploys if applicable
7. CEO approves final delivery

## Budget Management

Per-department token tracking with real-time cost display.
Daily budget enforcement: warns at 80%, hard-stop at 100%.

## License

MIT
