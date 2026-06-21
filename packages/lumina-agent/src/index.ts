#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { render } from 'ink';
import React from 'react';
import { TUIApp } from './tui/index.js';
import { loadConfig, ensureConfig } from './utils/config.js';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const program = new Command();

program
  .name('lumina')
  .description('Lumina Code - AI coding agent')
  .version('1.0.0');

program
  .command('code')
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
    render(
      React.createElement(TUIApp, {
        prompt,
        config,
        model: opts.model || config.defaultModel || 'openrouter/owl-alpha',
        autoApprove: opts.yes || false,
        cwd: opts.cwd,
      })
    );
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    const config = await ensureConfig();
    console.log('\n  Lumina Code Configuration\n');
    console.log('  Config file: ' + CONFIG_FILE);
    console.log('  API Key: ' + (config.openrouterKey ? 'Set (' + config.openrouterKey.slice(0, 8) + '...)' : 'NOT SET'));
    console.log('  Default Model: ' + (config.defaultModel || 'openrouter/owl-alpha'));
    console.log('  Coding Model: ' + (config.codingModel || 'moonshotai/kimi-k2.6'));
    console.log('  Fast Model: ' + (config.fastModel || 'openai/gpt-oss-20b:free'));
    console.log('\n  Commands:');
    console.log('    lumina config set openrouter-key <key>');
    console.log('    lumina config set default-model <model>');
    console.log('    lumina config set coding-model <model>');
    console.log('    lumina config set fast-model <model>\n');
  });

program
  .command('config set <key> <value>')
  .description('Set a config value')
  .action(async (key, value) => {
    const config = await ensureConfig();
    const keyMap: Record<string, string> = {
      'openrouter-key': 'openrouterKey',
      'default-model': 'defaultModel',
      'coding-model': 'codingModel',
      'fast-model': 'fastModel',
    };
    const configKey = keyMap[key] || key;
    (config as any)[configKey] = value;
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('  Set ' + key + ' = ' + value);
  });

program.parse();
