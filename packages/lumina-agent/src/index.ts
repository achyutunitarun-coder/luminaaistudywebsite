#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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

// ── Extract files from model output (multiple formats) ──────────────
function extractFiles(text) {
  const files = [];

  // Format 1: FILENAME: path ... END FILE
  const r1 = /FILENAME:\s*([\w./\-_]+)\n([\s\S]*?)END FILE/g;
  let m;
  while ((m = r1.exec(text)) !== null) {
    if (m[1] && m[2]?.trim()) files.push({ path: m[1].trim(), content: m[2].trim() });
  }

  // Format 2: ```filename ... ```
  if (files.length === 0) {
    const r2 = /```([\w./\-_]+)\n([\s\S]*?)```/g;
    while ((m = r2.exec(text)) !== null) {
      if (m[1] && m[2]?.trim()) files.push({ path: m[1].trim(), content: m[2].trim() });
    }
  }

  // Format 3: FILE: path\ncontent\nENDFILE
  if (files.length === 0) {
    const r3 = /FILE:\s*([\w./\-_]+)\n([\s\S]*?)ENDFILE/g;
    while ((m = r3.exec(text)) !== null) {
      if (m[1] && m[2]?.trim()) files.push({ path: m[1].trim(), content: m[2].trim() });
    }
  }

  return files;
}

function extractCommands(text) {
  const commands = [];
  const r = /COMMAND:\s*(.+)/g;
  let m;
  while ((m = r.exec(text)) !== null) commands.push(m[1].trim());
  return commands;
}

// ── Chat Loop ───────────────────────────────────────────────────────
async function chat(config) {
  console.log('  Type what you want to build. I\'ll handle the rest.');
  console.log('  Commands: /help /clear /files /exit\n');

  const createdFiles = new Set();

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();
    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') break;
    if (trimmed === '/clear') { console.log('  ✓ Cleared.\n'); continue; }
    if (trimmed === '/files') {
      if (createdFiles.size === 0) { console.log('  No files yet.\n'); }
      else { console.log('  Files:'); for (const f of createdFiles) console.log(`    ${f}`); console.log(''); }
      continue;
    }
    if (trimmed === '/help') { console.log('  /help /clear /files /exit\n'); continue; }

    console.log('  ⏳ Generating...\n');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      const systemPrompt = `You are LUMINA CODE. Create COMPLETE production-grade websites.

OUTPUT FORMAT — Use this exact format for EVERY file:

FILENAME: path/to/file.ext
[COMPLETE file content]
END FILE

RULES:
- Output COMPLETE files — every single line, no truncation
- Use Three.js for 3D, CSS animations for motion
- No placeholders, no TODOs, no lorem ipsum
- Beautiful, cinematic, production-quality
- Create ALL files needed for a working project

Working directory: ${process.cwd()}`;

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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmed },
          ],
          stream: false,
          max_tokens: 65536,
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
        console.log('  ⚠ No response from model.\n');
        continue;
      }

      const files = extractFiles(content);
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
      } else {
        // No files detected — save raw output
        const fallbackPath = 'lumina-output.txt';
        writeFileSync(join(process.cwd(), fallbackPath), content, 'utf-8');
        createdFiles.add(fallbackPath);
        console.log(`  ⚠ No files detected. Saved raw output to: ${fallbackPath}`);
        console.log('  First 300 chars:');
        console.log('  ' + content.slice(0, 300).replace(/\n/g, '\n  '));
        console.log('');
      }

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

      console.log(`\n  📊 Total files created: ${createdFiles.size}`);
      console.log('');

    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}\n`);
    }
  }

  rl.close();
}

const config = loadConfig();
if (!config?.openrouterKey) {
  onboarding().then(() => chat(loadConfig()).then(() => process.exit(0)));
} else {
  chat(config).then(() => process.exit(0));
}
