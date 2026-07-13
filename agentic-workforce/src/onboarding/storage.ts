import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import chalk from "chalk";
import type { AppConfig, ProviderKey } from "../config/types.js";

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".lumina-work");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const KEYS_PATH = path.join(CONFIG_DIR, "keys.enc");
const SALT_PATH = path.join(CONFIG_DIR, ".salt");
const PASSPHRASE_PATH = path.join(CONFIG_DIR, ".passphrase");

// ─── Directory setup ───

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ─── Keychain / encryption ───

function getMachineKey(): Buffer {
  const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown";
  const username = process.env.USER || process.env.USERNAME || "unknown";
  const salt = getOrCreateSalt();
  return crypto.scryptSync(`${hostname}:${username}`, salt, 32);
}

function getOrCreateSalt(): Buffer {
  ensureDir();
  if (fs.existsSync(SALT_PATH)) {
    return fs.readFileSync(SALT_PATH);
  }
  const salt = crypto.randomBytes(16);
  fs.writeFileSync(SALT_PATH, salt);
  return salt;
}

function getPassphrase(): string | null {
  try {
    if (fs.existsSync(PASSPHRASE_PATH)) {
      return fs.readFileSync(PASSPHRASE_PATH, "utf-8").trim();
    }
  } catch { /* ignore */ }
  return null;
}

export function setPassphrase(passphrase: string): void {
  ensureDir();
  fs.writeFileSync(PASSPHRASE_PATH, passphrase, "utf-8");
}

function deriveEncryptionKey(): Buffer {
  const passphrase = getPassphrase();
  if (passphrase) {
    const salt = getOrCreateSalt();
    return crypto.scryptSync(passphrase, salt, 32);
  }
  return getMachineKey();
}

export function encryptKeys(keys: ProviderKey[]): void {
  ensureDir();
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveEncryptionKey(), crypto.randomBytes(16));
  const iv = cipher.update(JSON.stringify(keys), "utf-8");
  const final = cipher.final();
  const authTag = cipher.getAuthTag();
  fs.writeFileSync(KEYS_PATH, Buffer.concat([iv, final, authTag]));
}

export function decryptKeys(): ProviderKey[] {
  try {
    if (!fs.existsSync(KEYS_PATH)) return [];
    const data = fs.readFileSync(KEYS_PATH);
    if (data.length < 32) return [];
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(data.length - 16);
    const encrypted = data.subarray(16, data.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = decipher.update(encrypted);
    const final = decipher.final();
    return JSON.parse(Buffer.concat([decrypted, final]).toString("utf-8")) as ProviderKey[];
  } catch {
    return [];
  }
}

// ─── Config persistence ───

export function loadConfig(): AppConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as AppConfig;
    // Decrypt and attach keys
    config.providers = config.providers.map(p => ({
      ...p,
      keys: p.keys.map(k => ({ ...k, key_ref: "" })),
    }));
    const decrypted = decryptKeys();
    if (decrypted.length > 0) {
      let idx = 0;
      config.providers = config.providers.map(p => ({
        ...p,
        keys: p.keys.map(k => {
          const dk = decrypted[idx] ?? k;
          idx++;
          return dk;
        }),
      }));
    }
    return config;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  ensureDir();
  // Extract and encrypt keys separately
  const allKeys: ProviderKey[] = [];
  const safeProviders = config.providers.map(p => ({
    ...p,
    keys: p.keys.map(k => {
      allKeys.push(k);
      return { label: k.label, validated_at: k.validated_at, validation_status: k.validation_status, key_ref: "" } as ProviderKey;
    }),
  }));
  const safeConfig = { ...config, providers: safeProviders };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(safeConfig, null, 2), "utf-8");
  encryptKeys(allKeys);
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

// ─── Resumability ───

export function getOnboardingStep(): number {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return 0;
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as AppConfig;
    return config.user_profile?.onboarding_step_completed ?? 0;
  } catch {
    return 0;
  }
}

export async function saveOnboardingStep(step: number, partial: Partial<AppConfig>): Promise<void> {
  ensureDir();
  try {
    let config: AppConfig;
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      config = JSON.parse(raw) as AppConfig;
    } else {
      const { defaultConfig } = await import("../config/types.js");
      config = defaultConfig();
    }
    // Deep merge: copy fields from partial, but keep step number we set
    if (partial.user_profile) {
      config.user_profile = { ...config.user_profile, ...partial.user_profile, onboarding_step_completed: step };
    }
    if (partial.providers) {
      config.providers = partial.providers.map(p => ({
        ...p,
        keys: p.keys.map(k => ({ label: k.label, validated_at: k.validated_at, validation_status: k.validation_status, key_ref: "" } as ProviderKey)),
      }));
    }
    if (partial.models) config.models = partial.models.map(m => ({ ...m }));
    if (partial.role_assignments) config.role_assignments = partial.role_assignments.map(r => ({ ...r }));
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error(chalk.red(`\n  Failed to save progress: ${err}\n`));
  }
}
