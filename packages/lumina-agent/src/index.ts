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
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   ⚡ LUMINA CODE — AI Coding Agent  ║');
  console.log('╚══════════════════════════════════════╝\n');
  const apiKey = await ask('  🔑 OpenRouter API key: ');
  if (!apiKey.trim() || apiKey.trim().length < 10) { console.log('  ❌ Invalid.'); process.exit(1); }
  saveConfig({ openrouterKey: apiKey.trim(), userName: 'User' });
  console.log('  ✅ Ready!\n');
}

function extractFiles(text) {
  const files = [];
  const fileRegex = /FILENAME:\s*([^\n]+)\n([\s\S]*?)END FILE/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const rawPath = match[1].trim();
    const content = match[2].trim();
    if (!rawPath || rawPath.endsWith('/') || !extname(rawPath)) continue;
    if (rawPath.includes('<') || rawPath.includes('"') || rawPath.includes('`')) continue;
    files.push({ path: rawPath, content });
  }
  return files;
}

async function chat(config) {
  console.log('  💬 Type what you want to build. /exit to quit.\n');
  const createdFiles = new Set();

  const SYSTEM = `You are LUMINA CODE — the world's best AI coding agent.

OUTPUT FORMAT — MANDATORY:
FILENAME: index.html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Title</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<!-- COMPLETE HTML -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script src="script.js"></script>
</body>
</html>
END FILE

FILENAME: style.css
/* COMPLETE CSS */
END FILE

FILENAME: script.js
// COMPLETE JS
END FILE

RULES: Start IMMEDIATELY with FILENAME: index.html. Do NOT describe. JUST OUTPUT COMPLETE FILES. No placeholders. No TODOs. Robot: Three.js primitives, PBR materials, wave/blink animations, scroll-driven sections (Hero=wave, Features=point, About=think, Contact=wave goodbye), particles, dark gradient bg. 56000 tokens max.

Working directory: ${process.cwd()}`;

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();
    if (!trimmed) continue;
    if (trimmed === '/exit') break;

    console.log('\n  ⏳ Streaming...\n');

    try {
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
            { role: 'system', content: SYSTEM },
            { role: 'user', content: trimmed },
          ],
          stream: true,
          max_tokens: 56000,
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
      }

      // Stream and collect full text
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullText = '';
      let filesCreated = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;

          let delta = '';
          try { delta = JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch { continue; }
          if (!delta) continue;

          fullText += delta;
          process.stdout.write(delta);
        }
      }

      console.log('\n');
      console.log(`  ✅ Stream complete (${fullText.length} chars)`);

      // Parse files from complete output
      const files = extractFiles(fullText);

      if (files.length === 0) {
        console.log('  ⚠ No files detected.\n');
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
          filesCreated++;
          console.log(`  ✅ ${file.path} (${file.content.length} chars)`);
        } catch (e) {
          console.log(`  ❌ ${file.path}: ${e.message}`);
        }
      }

      console.log(`\n  📊 Created ${filesCreated} file(s) | Total: ${createdFiles.size}\n`);

    } catch (e) {
      console.log(`  ❌ ${e.message}\n`);
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
