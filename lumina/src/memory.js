import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { countTokens } from './utils/tokens.js';

const CHECKPOINT_DIR = path.join(os.homedir(), '.lumina', 'checkpoints');

export function shouldSummarize(messages) {
  if (!Array.isArray(messages)) return false;
  const nonSystem = messages.filter(m => m.role !== 'system');
  if (nonSystem.length === 0) return false;
  if (nonSystem.length < 6) return false;
  if (nonSystem.length % 8 === 0) return true;
  const total = messages.reduce((s, m) => s + (m.content?.length || 0), 0);
  return total > 8000 && nonSystem.length % 4 === 0;
}

export function buildMemoryBlock(summary) {
  return {
    role: 'system',
    content: `[Earlier conversation summarized: ${summary}]`,
    isMemory: true
  };
}

export function compressHistory(messages, summary) {
  const memoryBlock = buildMemoryBlock(summary);
  const recent = messages.filter(m => m.role !== 'system').slice(-4);
  const systemMessages = messages.filter(m => m.role === 'system' && !m.isMemory);
  return [...systemMessages, memoryBlock, ...recent];
}

export function generateSummaryPrompt(messages) {
  const text = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(-4000);
  return {
    role: 'user',
    content: `Summarize this conversation in under 100 tokens. Capture: key decisions made, files created or modified, open questions or next steps, and the current task's status.\n\n${text}`
  };
}

export function saveCheckpoint(messages) {
  try {
    if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${timestamp}.json`);
    const data = {
      savedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content?.slice(0, 10000),
        isMemory: m.isMemory || false,
        isToolResult: m.isToolResult || false
      }))
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const checkpoints = fs.readdirSync(CHECKPOINT_DIR)
      .filter(f => f.startsWith('checkpoint-'))
      .sort()
      .reverse();
    for (const old of checkpoints.slice(5)) {
      try { fs.unlinkSync(path.join(CHECKPOINT_DIR, old)); } catch {}
    }

    return filePath;
  } catch {
    return null;
  }
}

export function loadLatestCheckpoint() {
  try {
    if (!fs.existsSync(CHECKPOINT_DIR)) return null;
    const checkpoints = fs.readdirSync(CHECKPOINT_DIR)
      .filter(f => f.startsWith('checkpoint-'))
      .sort()
      .reverse();
    if (checkpoints.length === 0) return null;
    const data = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, checkpoints[0]), 'utf-8'));
    return data.messages || null;
  } catch {
    return null;
  }
}
