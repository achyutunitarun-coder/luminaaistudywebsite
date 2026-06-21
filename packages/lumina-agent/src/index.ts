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

// ── Streaming chat with real-time file creation ─────────────────────
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

OUTPUT FORMAT — Use this exact format for every file:

FILENAME: path/to/file.ext
[COMPLETE file content — every line, no truncation]
END FILE

For commands:
COMMAND: npm install something

RULES:
- Output COMPLETE files — every single line
- Use Three.js for 3D, CSS animations for motion
- No placeholders, no TODOs, no lorem ipsum
- Beautiful, cinematic, production-quality
- Create ALL files needed for a working project

Working directory: ${process.cwd()}`;

    console.log('  ⏳ Generating...\n');

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
          stream: true,
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

      // Stream the response and create files in real-time
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentFile = null;
      let currentContent = '';
      let inFile = false;
      let fileCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (!delta) continue;

            // Process the delta character by character for file detection
            for (const char of delta) {
              if (!inFile) {
                // Check for FILENAME: pattern
                if (currentFile === null) {
                  // Accumulate to check for FILENAME:
                  if (!currentContent) {
                    if (char === 'F') currentContent = 'F';
                    else if (currentContent === 'F' && char === 'I') currentContent = 'FI';
                    else if (currentContent === 'FI' && char === 'L') currentContent = 'FIL';
                    else if (currentContent === 'FIL' && char === 'E') currentContent = 'FILE';
                    else if (currentContent === 'FILE' && char === 'N') currentContent = 'FILEN';
                    else if (currentContent === 'FILEN' && char === 'A') currentContent = 'FILENA';
                    else if (currentContent === 'FILENA' && char === 'M') currentContent = 'FILENAM';
                    else if (currentContent === 'FILENAM' && char === 'E') currentContent = 'FILENAME';
                    else if (currentContent === 'FILENAME' && char === ':') {
                      currentFile = '';
                      currentContent = '';
                      process.stdout.write('  📄 Creating: ');
                    } else {
                      // Not a FILENAME: pattern, just output
                      if (currentContent) {
                        process.stdout.write(currentContent + char);
                        currentContent = '';
                      } else {
                        process.stdout.write(char);
                      }
                    }
                  }
                } else {
                  // We're inside a filename or file content
                  if (char === '\n' && !inFile) {
                    // End of filename line
                    const filename = currentFile.trim();
                    currentFile = filename;
                    inFile = true;
                    currentContent = '';
                    console.log(`  ✓ ${filename}`);
                    fileCount++;
                  } else if (inFile) {
                    currentContent += char;
                    // Check for END FILE
                    if (currentContent.endsWith('END FILE')) {
                      const fileContent = currentContent.slice(0, -8).trim();
                      try {
                        const filePath = join(process.cwd(), currentFile);
                        const dir = dirname(resolve(filePath));
                        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                        writeFileSync(filePath, fileContent, 'utf-8');
                        createdFiles.add(currentFile);
                        console.log(`  ✓ Saved: ${currentFile} (${fileContent.length} chars)`);
                      } catch (e) {
                        console.log(`  ✗ Error saving ${currentFile}: ${e.message}`);
                      }
                      currentFile = null;
                      currentContent = '';
                      inFile = false;
                    }
                  } else {
                    currentFile += char;
                  }
                }
              }
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }

      console.log(`\n  📊 Created ${fileCount} file(s) total: ${createdFiles.size}`);
      console.log('');

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
