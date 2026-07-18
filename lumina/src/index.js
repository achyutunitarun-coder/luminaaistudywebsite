import React from 'react';
import { render } from 'ink';
import { loadConfig, configExists } from './config.js';
import { runOnboarding } from './onboarding.js';
import { OpenAIProvider } from './api/openai.js';
import { AnthropicProvider } from './api/anthropic.js';
import { GoogleProvider } from './api/google.js';
import { GroqProvider } from './api/groq.js';
import { TogetherProvider } from './api/together.js';
import { CustomProvider } from './api/custom.js';
import { writeAllCodeBlocks } from './utils/files.js';
import { runAutoLoop, parseToolBlocks, TOOL_DEFINITIONS } from './tools.js';
import personas from './personas/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import App from './tui/app.js';
import { ModeManager } from './modes/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = pkg.version;

function getProviderInstance(providerName, config) {
  const providers = {
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    google: GoogleProvider,
    groq: GroqProvider,
    together: TogetherProvider,
    custom: CustomProvider,
  };
  const Klass = providers[providerName];
  if (!Klass) throw new Error(`Unknown provider: ${providerName}`);
  return new Klass(config);
}

export async function main(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        flags.reconfig = true;
        break;
      case '--model':
      case '-m':
        flags.model = args[++i];
        break;
      case '--persona':
      case '-p':
        flags.persona = args[++i];
        break;
      case '--mode':
        flags.mode = args[++i];
        break;
      case '--budget':
      case '-b':
        flags.budget = args[++i];
        break;
      case '--execute':
      case '-e':
        flags.execute = args[++i];
        break;
      case '--mode':
        flags.mode = args[++i];
        break;
      case '--no-write':
        flags.noWrite = true;
        break;
      case '--no-tools':
        flags.noTools = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        return;
      case '--version':
      case '-v':
        console.log('lumina v' + VERSION);
        return;
      default:
        if (args[i].startsWith('-')) {
          console.log(`Unknown flag: ${args[i]}`);
          printHelp();
          process.exit(1);
        }
        flags.execute = args.slice(i).join(' ');
        i = args.length;
        break;
    }
  }

  if (flags.execute) {
    const configFromFlags = loadConfig();
    if (!configFromFlags.provider) {
      console.log('No provider configured. Run lumina --config or set up first.');
      process.exit(1);
    }
    applySessionOverrides(configFromFlags, flags);
    const provider = getProviderInstance(configFromFlags.provider, configFromFlags);
    const persona = personas[configFromFlags.persona] || personas.general;
    const modeManager = new ModeManager();
    if (flags.mode) modeManager.setMode(flags.mode);
    let systemContent = modeManager.applyModeToPrompt(persona.systemPrompt);
    if (persona.name === 'general' && !flags.noTools) {
      systemContent += '\n\n' + TOOL_DEFINITIONS;
    }
    const msgs = [{ role: 'system', content: systemContent }, { role: 'user', content: flags.execute }];
    try {
      let full;
      if (flags.noTools) {
        full = await provider.chat(msgs, {
          model: configFromFlags.defaultModel,
          maxTokens: configFromFlags.tokenBudget === 'unlimited' ? 8192 : configFromFlags.tokenBudget,
          onToken: (t) => process.stdout.write(t)
        });
      } else {
        full = await runAutoLoop(msgs, provider, configFromFlags, (t) => process.stdout.write(t));
      }
      process.stdout.write('\n');

      if (!flags.noWrite) {
        const results = writeAllCodeBlocks(full);
        if (results.length > 0) {
          process.stdout.write('\n');
          for (const r of results) {
            if (r.error) {
              process.stdout.write('  \u2716 ' + r.filename + ' (' + r.error + ')\n');
            } else {
              process.stdout.write('  \u2713 ' + r.filename + '\n');
            }
          }
          process.stdout.write('\n');
        }
      }
    } catch (err) {
      process.stdout.write('\n');
      console.error('\u2716 Error:', err.message);
      if (err.message && err.message.includes('401')) {
        console.error('  Your API key may be invalid. Run: lumina --config');
      } else if (err.message && (err.message.includes('fetch') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED'))) {
        console.error('  Network error. Check your connection and API base URL.');
      }
      process.exit(1);
    }
    return;
  }

  if (!configExists() || flags.reconfig) {
    const existing = flags.reconfig ? loadConfig() : null;
    await runOnboarding(existing);
    if (flags.reconfig) {
      const updated = loadConfig();
      applySessionOverrides(updated, flags);
      saveAndLaunch(updated);
    }
    return;
  }

  let config = loadConfig();

  if (config.firstRun) {
    await runOnboarding();
    config = loadConfig();
  }

  applySessionOverrides(config, flags);
  launchTUI(config);
}

function printHelp() {
  console.log(`
lumina — AI CLI for software engineering

Usage:
  lumina                    Start interactive TUI session
  lumina -e <prompt>        Run a one-shot prompt and exit
  lumina --config           Re-run setup wizard
  lumina --model <model>    Override model for session
  lumina --persona <name>   Override persona (general|coder|reviewer|fixer|planner)
  lumina --mode <name>      Set mode (chat|plan|code|review|debug)
  lumina --budget <n>       Override token budget (2048|4096|8192|unlimited)
  lumina --no-write          Skip writing code blocks to disk (in -e mode)
  lumina --no-tools          Skip tool-use loop (in -e mode)
  lumina --help             Show this help
  lumina --version          Show version

Commands (inside TUI):
  :q                        Quit
  :m <model>                Switch model
  :p <persona>              Switch persona
  :b <budget>               Set token budget
  :clear                    Clear conversation
  :save <name>              Save conversation
  :load <path>              Load conversation
  :ls                       List saved conversations
  :export <name>            Export as markdown
  :write <file>             Write last response to a file
  :writeall                 Extract and write all code blocks
  :autowrite                Toggle auto-write of code blocks
  (Code blocks auto-write to disk by default.)
`);
}

function applySessionOverrides(config, flags) {
  if (flags.model) config.defaultModel = flags.model;
  if (flags.persona) config.persona = flags.persona;
  if (flags.mode) config.mode = flags.mode;
  if (flags.budget) {
    config.tokenBudget = flags.budget === 'unlimited' ? 'unlimited' : parseInt(flags.budget, 10);
  }
}

function launchTUI(config) {
  const provider = getProviderInstance(config.provider, config);

  const { waitUntilExit } = render(
    React.createElement(App, { provider, initialConfig: config })
  );

  process.on('SIGINT', () => {
    process.exit(0);
  });

  waitUntilExit().catch(() => {});
}

function saveAndLaunch(config) {
  launchTUI(config);
}
