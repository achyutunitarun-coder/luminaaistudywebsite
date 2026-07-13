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
import App from './tui/app.js';

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
      case '--budget':
      case '-b':
        flags.budget = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        return;
      case '--version':
      case '-v':
        console.log('lumina-ai-cli v1.0.0');
        return;
      default:
        console.log(`Unknown flag: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
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
lumina-ai-cli - Personal AI Assistant CLI

Usage:
  lumina                    Start interactive TUI
  lumina-ai-cli             Same as above
  lumina --config           Re-run setup
  lumina --model <model>    Override model for session
  lumina --persona <name>   Override persona for session
  lumina --budget <n>       Override token budget (128|256|512|unlimited)
  lumina --help             Show this help
  lumina --version          Show version
`);
}

function applySessionOverrides(config, flags) {
  if (flags.model) config.defaultModel = flags.model;
  if (flags.persona) config.persona = flags.persona;
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
