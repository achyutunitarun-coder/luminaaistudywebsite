#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve, extname } from 'path';
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

function extractFiles(text) {
  const files = [];
  const fileRegex = /FILENAME:\s*([^\n]+)\n([\s\S]*?)END FILE/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const rawPath = match[1].trim();
    const content = match[2].trim();
    if (!rawPath || rawPath.endsWith('/') || !extname(rawPath)) continue;
    if (rawPath.includes('<') || rawPath.includes('>') || rawPath.includes('"')) continue;
    files.push({ path: rawPath, content });
  }
  return files;
}

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

    const systemPrompt = `You are LUMINA CODE. Create COMPLETE production-grade websites.

OUTPUT FORMAT — Use this EXACT format for EVERY file:

FILENAME: index.html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Title</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<!-- Complete HTML here -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="script.js"></script>
</body>
</html>
END FILE

FILENAME: style.css
/* Complete CSS here */
END FILE

FILENAME: script.js
// Complete JavaScript here
END FILE

RULES:
- Start IMMEDIATELY with FILENAME: index.html
- Output COMPLETE files — every line, no truncation
- Do NOT describe what you will do — JUST DO IT
- Do NOT output any text before FILENAME:
- Do NOT use markdown code blocks
- Create ALL files needed for a complete working project
- Use Three.js from CDN for 3D
- No placeholders, no TODOs, no lorem ipsum

Working directory: ${process.cwd()}`;

    console.log('');
    console.log('  ⏳ Sending to AI...');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

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
          max_tokens: 16000,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
      }

      console.log('  ⏳ AI is thinking...');
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        console.log('  ⚠ No response from model.\n');
        continue;
      }

      console.log('  ✓ AI responded! Parsing files...\n');

      const files = extractFiles(content);

      if (files.length === 0) {
        console.log('  ⚠ No files detected. Full output:\n');
        console.log('  ──────────────────────────────────────');
        // Print first 100 lines
        const lines = content.split('\n').slice(0, 100);
        for (const line of lines) {
          console.log('  ' + line);
        }
        if (content.split('\n').length > 100) {
          console.log('  ... (truncated)');
        }
        console.log('  ──────────────────────────────────────\n');
        continue;
      }

      console.log(`  📁 Found ${files.length} file(s):\n`);
      for (const file of files) {
        try {
          const filePath = join(process.cwd(), file.path);
          const dir = dirname(resolve(filePath));
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(filePath, file.content, 'utf-8');
          createdFiles.add(file.path);
          console.log(`  ✅ ${file.path} (${file.content.length} chars)`);
        } catch (e) {
          console.log(`  ❌ ${file.path}: ${e.message}`);
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
