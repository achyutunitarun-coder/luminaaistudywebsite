#!/usr/bin/env node
// @ts-nocheck
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function loadConfig() {
  try { if (!existsSync(CONFIG_FILE)) return null; return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}

async function ensureConfig() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = await loadConfig();
  if (existing) return existing;
  const defaults = { openrouterKey: '', defaultEffort: 'normal' };
  writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
  return defaults;
}

const program = new Command();
program.name('lumina').description('Lumina Code — AI coding agent').version('1.0.0');

program.command('code')
  .description('Start Lumina Code agent')
  .argument('[prompt]', 'What you want to build')
  .option('-e, --effort <level>', 'Effort level: quick, normal, beast', 'normal')
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
    const effort = ['quick', 'normal', 'beast'].includes(opts.effort) ? opts.effort : 'normal';
    const { TUIApp } = await import('./tui/index.js');
    const { render } = await import('ink');
    const React = await import('react');
    render(React.createElement(TUIApp, { prompt, config, effort, autoApprove: opts.yes || false, cwd: opts.cwd }));
  });

program.command('config').description('Show configuration').action(async () => {
  const config = await ensureConfig();
  console.log('\n  Lumina Code Configuration\n');
  console.log('  Config:', CONFIG_FILE);
  console.log('  API Key:', config.openrouterKey ? 'Set (' + config.openrouterKey.slice(0, 8) + '...)' : 'NOT SET');
  console.log('  Default Effort:', config.defaultEffort || 'normal');
  console.log('\n  Commands:');
  console.log('    lumina config set openrouter-key <key>');
  console.log('    lumina config set default-effort <quick|normal|beast>\n');
});

program.command('config set <key> <value>').description('Set config value').action(async (key, value) => {
  const config = await ensureConfig();
  (config as any)[key] = value;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log('  Set', key, '=', value);
});

program.parse();
