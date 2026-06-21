#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import of TUI (works after build)
async function runTUI(prompt: string, config: any, model: string, autoApprove: boolean, cwd: string) {
  try {
    const { TUIApp } = await import(join(__dirname, 'tui', 'index.js'));
    const { render } = await import('ink');
    const React = await import('react');
    render(
      React.createElement(TUIApp, { prompt, config, model, autoApprove, cwd })
    );
  } catch (e: any) {
    console.error('  Error loading TUI:', e.message);
    console.error('  Make sure to run: npm run build');
    process.exit(1);
  }
}

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function loadConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return null;
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch { return null; }
}

async function ensureConfig() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = await loadConfig();
  if (existing) return existing;
  const defaults = {
    openrouterKey: '',
    defaultModel: 'openrouter/owl-alpha',
    codingModel: 'moonshotai/kimi-k2.6',
    fastModel: 'openai/gpt-oss-20b:free',
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
  return defaults;
}

const program = new Command();
program.name('lumina').description('Lumina Code - AI coding agent').version('1.0.0');

program.command('code')
  .description('Start Lumina Code agent')
  .argument('[prompt]', 'What you want to build')
  .option('-m, --model <model>', 'Model to use')
  .option('-y, --yes', 'Auto-approve all actions')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .action(async (prompt, opts) => {
    const config = await ensureConfig();
    if (!config.openrouterKey) {
      console.error('\n  ERROR: OpenRouter API key not set.\n');
      console.error('  Set it with: lumina config set openrouter-key YOUR_KEY');
      console.error('  Get a key at: https://openrouter.ai/keys\n');
      process.exit(1);
    }
    await runTUI(
      prompt,
      config,
      opts.model || config.defaultModel || 'openrouter/owl-alpha',
      opts.yes || false,
      opts.cwd
    );
  });

program.command('config').description('Show configuration').action(async () => {
  const config = await ensureConfig();
  console.log('\n  Lumina Code Configuration\n');
  console.log('  Config:', CONFIG_FILE);
  console.log('  API Key:', config.openrouterKey ? 'Set (' + config.openrouterKey.slice(0, 8) + '...)' : 'NOT SET');
  console.log('  Default:', config.defaultModel || 'openrouter/owl-alpha');
  console.log('  Coding:', config.codingModel || 'moonshotai/kimi-k2.6');
  console.log('  Fast:', config.fastModel || 'openai/gpt-oss-20b:free\n');
});

program.command('config set <key> <value>').description('Set config value').action(async (key, value) => {
  const config = await ensureConfig();
  const map: Record<string, string> = { 'openrouter-key': 'openrouterKey', 'default-model': 'defaultModel', 'coding-model': 'codingModel', 'fast-model': 'fastModel' };
  (config as any)[map[key] || key] = value;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log('  Set', key, '=', value);
});

program.parse();
