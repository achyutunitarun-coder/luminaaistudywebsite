#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve, extname } from 'path';
import { createInterface } from 'readline';

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
    console.log('  ⏳ Generating...');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600000); // 10 min timeout

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
          max_tokens: 65000,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
      }

      // Read response as text first, then parse
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        // If JSON is truncated, try to fix it
        console.log('  ⚠ Response was truncated. Attempting to parse...');
        // Try to find the last complete JSON object
        const lastBrace = rawText.lastIndexOf('}');
        if (lastBrace > 0) {
          try {
            data = JSON.parse(rawText.slice(0, lastBrace + 1));
          } catch (e2) {
            throw new Error('Response was truncated and could not be parsed. Try a shorter prompt.');
          }
        } else {
          throw new Error('Response was truncated. Try a shorter prompt.');
        }
      }

      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        console.log('  ⚠ No response from model.\n');
        continue;
      }

      console.log(`  ✓ AI responded (${content.length} chars)`);

      const files = extractFiles(content);

      if (files.length === 0) {
        console.log('  ⚠ No files detected in output.\n');
        // Show first 50 lines of output
        const lines = content.split('\n').slice(0, 50);
        console.log('  ── Output preview ──');
        for (const line of lines) console.log('  ' + line);
        console.log('  ── End ──\n');
        continue;
      }

      console.log(`  📁 Creating ${files.length} file(s):\n`);
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

      console.log(`\n  📊 Total files: ${createdFiles.size}\n`);

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
