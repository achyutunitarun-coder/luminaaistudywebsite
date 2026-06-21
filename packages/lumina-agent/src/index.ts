#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try { if (!existsSync(CONFIG_FILE)) return null; return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(r => rl.question(q, r)); }

async function onboarding() {
  console.log('\n  ⚡ LUMINA CODE — AI Coding Agent\n');
  const apiKey = await ask('  Enter your OpenRouter API key: ');
  if (!apiKey.trim() || apiKey.trim().length < 10) { console.log('  ❌ Invalid key.'); process.exit(1); }
  const name = await ask('  Your name (optional): ');
  saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
  console.log('  ✓ Ready!\n');
}

// ── Parse code blocks from model output ─────────────────────────────
function parseCodeBlocks(text) {
  const files = [];
  // Match ```filename ... ``` blocks
  const blockRegex = ```([\w./\-_]+)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const filename = match[1]?.trim();
    const content = match[2].trim();
    if (filename && content) {
      files.push({ path: filename, content });
    }
  }
  // Also match FILE: path ... END FILE blocks
  const fileRegex = /FILE:\s*([\w./\-_]+)\n([\s\S]*?)END FILE/g;
  while ((match = fileRegex.exec(text)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].trim() });
  }
  return files;
}

// ── Execute shell commands from model output ────────────────────────
function extractCommands(text) {
  const commands = [];
  const cmdRegex = /COMMAND:\s*(.+)/g;
  let match;
  while ((match = cmdRegex.exec(text)) !== null) {
    commands.push(match[1].trim());
  }
  return commands;
}

// ── Chat Loop ───────────────────────────────────────────────────────
async function chat(config) {
  console.log('  Type what you want to build. I\'ll handle the rest.');
  console.log('  Commands: /help /clear /files /run /exit\n');

  const createdFiles = new Set();
  let conversationHistory = [];

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') break;
    if (trimmed === '/clear') { conversationHistory = []; console.log('  ✓ Cleared.\n'); continue; }
    if (trimmed === '/files') {
      if (createdFiles.size === 0) { console.log('  No files created yet.\n'); }
      else { console.log('  Created files:'); for (const f of createdFiles) console.log(`    ${f}`); console.log(''); }
      continue;
    }
    if (trimmed === '/help') {
      console.log('  Commands: /help /clear /files /run <cmd> /exit\n');
      continue;
    }
    if (trimmed.startsWith('/run ')) {
      const cmd = trimmed.slice(5);
      try {
        console.log(`  Running: ${cmd}`);
        const out = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
        console.log(`  ${out.slice(0, 500)}`);
      } catch (e) { console.log(`  Error: ${e.message}`); }
      console.log('');
      continue;
    }

    // Build the prompt
    const systemPrompt = `You are LUMINA CODE — an elite AI coding agent. You create COMPLETE, production-grade websites and apps.

CRITICAL RULES:
1. Output COMPLETE files using this exact format:
   FILENAME: path/to/file.ext
   [complete file content]
   END FILE

2. Output shell commands using:
   COMMAND: npm install something
   COMMAND: npm run build

3. Create ALL necessary files for a complete, working project
4. Use modern HTML/CSS/JS, Three.js for 3D, CSS animations
5. No placeholders, no TODOs, no lorem ipsum
6. Beautiful, cinematic, production-quality code
7. Each file should be COMPLETE — not snippets

Working directory: ${process.cwd()}

Example output:
FILENAME: index.html
<!DOCTYPE html>
<html>
...
</html>
END FILE

FILENAME: style.css
:root { --bg: #0a0a0f; }
...
END FILE

FILENAME: script.js
import * as THREE from 'three';
...
END FILE

COMMAND: npm install three
COMMAND: npm run build`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: trimmed },
    ];

    console.log('  ⏳ Generating...\n');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouterKey}`,
          'HTTP-Referer': 'https://luminaai.co.in',
          'X-Title': 'Lumina Code',
        },
        body: JSON.stringify({
          model: 'openrouter/owl-alpha',
          messages,
          stream: false,
          max_tokens: 16000,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        console.log('  ⚠ No response from model. Try again.\n');
        continue;
      }

      // Parse and create files
      const files = parseCodeBlocks(content);
      const commands = extractCommands(content);

      if (files.length > 0) {
        console.log(`  📁 Creating ${files.length} file(s)...\n`);
        for (const file of files) {
          try {
            const filePath = join(process.cwd(), file.path);
            const dir = dirname(resolve(filePath));
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(filePath, file.content, 'utf-8');
            createdFiles.add(file.path);
            console.log(`  ✓ ${file.path} (${file.content.length} chars)`);
          } catch (e) {
            console.log(`  ✗ ${file.path}: ${e.message}`);
          }
        }
      }

      // Execute commands
      if (commands.length > 0) {
        console.log(`\n  ⚙ Running ${commands.length} command(s)...\n`);
        for (const cmd of commands) {
          try {
            console.log(`  $ ${cmd}`);
            const out = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
            console.log(`  ✓ ${out.slice(0, 200)}`);
          } catch (e) {
            console.log(`  ✗ ${e.message}`);
          }
        }
      }

      // Show any text output from the model
      const textOnly = content
        .replace(/FILENAME:[\s\S]*?END FILE/g, '')
        .replace(/COMMAND:.+/g, '')
        .trim();

      if (textOnly) {
        console.log(`\n  💬 ${textOnly.slice(0, 500)}`);
      }

      console.log(`\n  📊 Total files created: ${createdFiles.size}`);
      console.log('');

      // Save conversation
      conversationHistory.push({ role: 'user', content: trimmed });
      conversationHistory.push({ role: 'assistant', content });
      // Keep last 10 messages
      if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}\n`);
    }
  }

  rl.close();
}

// ── Main ────────────────────────────────────────────────────────────
const config = loadConfig();
if (!config?.openrouterKey) {
  onboarding().then(() => chat(loadConfig()).then(() => process.exit(0)));
} else {
  chat(config).then(() => process.exit(0));
}
