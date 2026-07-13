import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STATE_DIR = path.join(os.homedir(), '.lumina-work');
const STATE_PATH = path.join(STATE_DIR, 'state.json');

export function saveState(data) {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    const state = {
      tasks: data.tasks || [],
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {}
}

export function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}
