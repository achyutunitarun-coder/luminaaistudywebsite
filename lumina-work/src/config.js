import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.lumina-work');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  companyName: 'LuminaCorp',
  projectName: 'main',
  teamSize: 'medium',
  provider: null,
  apiKey: null,
  baseUrl: null,
  departments: {
    ceo: { model: null, agentCount: 1, active: true },
    cto: { model: null, agentCount: 1, active: true },
    engineering: { model: null, agentCount: 2, active: true },
    design: { model: null, agentCount: 1, active: true },
    qa: { model: null, agentCount: 1, active: true },
    devops: { model: null, agentCount: 1, active: true },
    marketing: { model: null, agentCount: 1, active: false }
  },
  allModels: [],
  budget: { daily: 10.0, spent: 0.0, currency: 'USD' },
  version: '1.0.0',
  firstRun: true
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
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch {}
}

export function configExists() {
  return fs.existsSync(CONFIG_PATH);
}
