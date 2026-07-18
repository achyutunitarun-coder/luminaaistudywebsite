import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.lumina');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  provider: null,
  apiKey: null,
  baseUrl: null,
  defaultModel: null,
  availableModels: [],
  persona: 'general',
  tokenBudget: 8192,
  firstRun: true,
  version: '1.0.0'
};

export function getConfigPath() {
  return CONFIG_PATH;
}

export function getConfigDir() {
  return CONFIG_DIR;
}

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {}
}

export function configExists() {
  return fs.existsSync(CONFIG_PATH);
}
