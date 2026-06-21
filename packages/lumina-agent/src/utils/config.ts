import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const SESSIONS_DIR = join(CONFIG_DIR, 'sessions');

export interface LuminaConfig {
  openrouterKey: string;
  defaultModel: string;
  codingModel: string;
  fastModel: string;
}

export async function loadConfig(): Promise<LuminaConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) return null;
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function ensureConfig(): Promise<LuminaConfig> {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
  
  const existing = await loadConfig();
  if (existing) return existing;

  const defaults: LuminaConfig = {
    openrouterKey: '',
    defaultModel: 'openrouter/owl-alpha',
    codingModel: 'moonshotai/kimi-k2.6',
    fastModel: 'openai/gpt-oss-20b:free',
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
  return defaults;
}

export function saveSession(id: string, data: unknown) {
  const file = join(SESSIONS_DIR, `${id}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export function loadSession(id: string): unknown | null {
  const file = join(SESSIONS_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf-8'));
}
