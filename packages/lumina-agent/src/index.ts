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
  const cwd = process.cwd();

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

    console.log(`\n  ⏳ Generating in ${cwd}...\n`);

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
              content: `You create COMPLETE production-grade websites. You MUST output files using this EXACT format:

---FILE: index.html
<!DOCTYPE html>
<html>
COMPLETE file content here
</html>
---END

---FILE: style.css
:root { --bg: #0a0a0f; }
COMPLETE CSS here
---END

---FILE: script.js
// COMPLETE JS here
---END

RULES:
- Output COMPLETE files — every single line, NO truncation
- Use Three.js from CDN (https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) for 3D
- Use CSS animations for motion
- No placeholders, no TODOs, no lorem ipsum
- Beautiful, cinematic, production-quality
- Create index.html, style.css, script.js at minimum
- Working directory: ${cwd}`,
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

      // Debug: show raw response length
      console.log(`  📝 Response: ${content.length} chars\n`);

      // Parse files using regex
      const fileRegex = /---FILE:\s*([\w./\-_]+)\n([\s\S]*?)---END/g;
      let match;
      let fileCount = 0;

      while ((match = fileRegex.exec(content)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();

        if (filePath && fileContent) {
          try {
            const fullPath = join(cwd, filePath);
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

      // If no files were created, try alternative format (code blocks)
      if (fileCount === 0) {
        console.log('  ⚠ No files found in ---FILE: format, trying code blocks...\n');
        const blockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
        let blockMatch;
        let blockCount = 0;

        while ((blockMatch = blockRegex.exec(content)) !== null) {
          const lang = blockMatch[1] || '';
          const code = blockMatch[2].trim();

          if (!code || code.length < 10) continue;

          // Determine filename from language
          let filename;
          if (lang === 'html' || lang === 'htm') filename = 'index.html';
          else if (lang === 'css') filename = 'style.css';
          else if (lang === 'javascript' || lang === 'js') filename = 'script.js';
          else if (lang === 'typescript' || lang === 'ts') filename = 'app.ts';
          else if (lang === 'json') filename = 'package.json';
          else if (lang === 'python' || lang === 'py') filename = 'main.py';
          else if (lang === 'bash' || lang === 'sh') filename = 'run.sh';
          else filename = `file${blockCount}.${lang || 'txt'}`;

          // Skip duplicates
          if (createdFiles.has(filename)) {
            filename = filename.replace('.', `${blockCount}.`);
          }

          try {
            const fullPath = join(cwd, filename);
            writeFileSync(fullPath, code, 'utf-8');
            createdFiles.add(filename);
            blockCount++;
            console.log(`  ✓ ${filename} (${code.length} chars) [from code block]`);
          } catch (e) {
            console.log(`  ✗ ${filename}: ${e.message}`);
          }
        }
        fileCount = blockCount;
      }

      // If STILL no files, dump the response for debugging
      if (fileCount === 0) {
        console.log('  ⚠ Could not parse files. Raw response preview:');
        console.log('  ---');
        console.log(content.slice(0, 500));
        console.log('  ---\n');
      } else {
        console.log(`\n  📊 Created ${fileCount} file(s)\n`);
      }

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
