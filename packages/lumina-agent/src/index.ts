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
  saveConfig({ openrouterKey: apiKey.trim() });
  console.log('  ✓ Ready!\n');
}

async function chat(config) {
  console.log('  Type what you want to build.');
  console.log('  Commands: /files /exit\n');

  const createdFiles = new Set();

  while (true) {
    const input = await ask('\n  > ');
    const trimmed = input.trim();
    if (!trimmed) continue;
    if (trimmed === '/exit') break;
    if (trimmed === '/files') {
      if (createdFiles.size === 0) { console.log('  No files yet.\n'); }
      else { for (const f of createdFiles) console.log(`  ${f}`); console.log(''); }
      continue;
    }

    console.log('  ⏳ Generating...\n');

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
            {
              role: 'system',
              content: `You create COMPLETE production-grade websites. Output EVERY file needed.

FORMAT — For EACH file output exactly:
---FILE: path/to/file.ext
[COMPLETE file content]
---END

For commands:
---COMMAND: npm install something

RULES:
- Output COMPLETE files — every single line, no truncation
- Use Three.js from CDN for 3D
- CSS animations for motion
- No placeholders, no TODOs, no lorem ipsum
- Beautiful, cinematic, production-quality
- Create index.html, style.css, script.js at minimum

Working directory: ${process.cwd()}`
            },
            { role: 'user', content: trimmed },
          ],
          stream: false,
          max_tokens: 16000,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        console.log('  ⚠ Empty response. Try again.\n');
        continue;
      }

      // Parse files using simple regex
      const fileRegex = /---FILE:\s*([\w./\-_]+)\n([\s\S]*?)---END/g;
      let match;
      let fileCount = 0;

      while ((match = fileRegex.exec(content)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();

        if (filePath && fileContent) {
          try {
            const fullPath = join(process.cwd(), filePath);
            const dir = dirname(resolve(fullPath));
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(fullPath, fileContent, 'utf-8');
            createdFiles.add(filePath);
            fileCount++;
            console.log(`  ✓ ${filePath} (${fileContent.length} chars)`);
          } catch (e) {
            console.log(`  ✗ ${filePath}: ${e.message}`);
          }
        }
      }

      // Parse and run commands
      const cmdRegex = /---COMMAND:\s*(.+)/g;
      while ((match = cmdRegex.exec(content)) !== null) {
        const cmd = match[1].trim();
        try {
          console.log(`  ⚙ ${cmd}`);
          const out = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
          console.log(`  ✓ Done`);
        } catch (e) {
          console.log(`  ✗ ${e.message}`);
        }
      }

      // Show any remaining text
      const textOnly = content
        .replace(/---FILE:[\s\S]*?---END/g, '')
        .replace(/---COMMAND:.+/g, '')
        .trim();

      if (textOnly) {
        console.log(`\n  ${textOnly.slice(0, 300)}`);
      }

      console.log(`\n  📊 Created ${fileCount} file(s)\n`);

    } catch (e) {
      console.log(`  ⚠ ${e.message}\n`);
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
